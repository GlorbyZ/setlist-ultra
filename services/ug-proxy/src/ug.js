const SUPPORTED_HOSTS = new Set(['tabs.ultimate-guitar.com', 'www.ultimate-guitar.com']);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractJsStore(html) {
  const match =
    html.match(/class="js-store"[^>]*data-content="([^"]*)"/i) ||
    html.match(/data-content="([^"]*)"[^>]*class="js-store"/i);
  if (!match) return null;
  try {
    return JSON.parse(decodeEntities(match[1]));
  } catch {
    return null;
  }
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  for (const value of Object.values(node)) walk(value, visit);
}

function parseChordLine(line) {
  const chords = [];
  const re = /[A-G][#b]?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\d|\d)*(?:\/[A-G][#b]?)?/g;
  let match;
  while ((match = re.exec(line))) {
    chords.push({ note: match[0], pre_spaces: match.index });
  }
  return chords;
}

function wikiToLines(content) {
  const text = String(content ?? '').replace(/\r/g, '');
  const lines = [];

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\u00a0/g, ' ').replace(/\[tab\]|\[\/tab\]/gi, '');
    if (!line.trim()) {
      lines.push({ type: 'blank' });
      continue;
    }

    if (/\[ch\]/i.test(line)) {
      let visible = '';
      const chords = [];
      const re = /\[ch\]([\s\S]*?)\[\/ch\]/gi;
      let last = 0;
      let match;
      while ((match = re.exec(line))) {
        visible += line.slice(last, match.index);
        const note = String(match[1] ?? '').trim();
        if (note) chords.push({ note, pre_spaces: visible.length });
        visible += note;
        last = match.index + match[0].length;
      }
      visible += line.slice(last);
      const leftover = visible.replace(/[A-G][#b]?[^\s]*/gi, '').replace(/\s/g, '');
      if (chords.length && !leftover) {
        lines.push({ type: 'chords', chords });
      } else {
        lines.push({ type: 'lyric', lyric: visible });
      }
      continue;
    }

    const chordish = /^[\sA-G#b\/majminaugdimsusadd0-9°ø()NC.|-]+$/i.test(line) && /[A-G]/.test(line);
    if (chordish && line.trim().length < 96) {
      const chords = parseChordLine(line);
      if (chords.length) {
        lines.push({ type: 'chords', chords });
        continue;
      }
    }
    lines.push({ type: 'lyric', lyric: line });
  }

  return lines;
}

function collectSearchResults(store) {
  const results = [];
  walk(store, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const url = node.tab_url || node.tabUrl || node.url;
    if (typeof url !== 'string' || !url.includes('/tab/')) return;
    const title =
      [node.song_name || node.songName, node.artist_name || node.artistName].filter(Boolean).join(' — ') ||
      node.marketing_type ||
      url;
    const abs = url.startsWith('http') ? url : `https://tabs.ultimate-guitar.com${url.startsWith('/') ? '' : '/'}${url}`;
    if (results.some((row) => row.url === abs)) return;
    results.push({ title: String(title).trim(), url: abs });
  });
  return results.slice(0, 20);
}

function tabFromStore(store) {
  let tabMeta = {};
  let wiki = '';
  walk(store, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (node.song_name && node.artist_name && (node.tab_url || node.id)) {
      tabMeta = node;
    }
    if (typeof node.content === 'string' && node.content.includes('[ch]')) {
      wiki = node.content;
    }
  });
  if (!wiki && !tabMeta.song_name) return null;
  return {
    tab: {
      title: tabMeta.song_name || 'Imported chart',
      artist_name: tabMeta.artist_name || '',
      author: tabMeta.username,
      key: tabMeta.tonality_name,
      capo: tabMeta.capo ? String(tabMeta.capo) : undefined,
      tuning: Array.isArray(tabMeta.tuning) ? tabMeta.tuning.join(' ') : tabMeta.tuning,
      difficulty: tabMeta.difficulty,
      lines: wikiToLines(wiki),
    },
  };
}

function hrefResults(html) {
  const results = [];
  const re = /href="(https?:\/\/tabs\.ultimate-guitar\.com\/tab\/[^"]+)"[^>]*>([^<]{2,120})</gi;
  let match;
  while ((match = re.exec(html))) {
    const url = match[1].replace(/&amp;/g, '&');
    const title = decodeEntities(match[2]).trim();
    if (!title || results.some((row) => row.url === url)) continue;
    results.push({ title, url });
  }
  return results.slice(0, 20);
}

export async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Upstream ${response.status}`);
  }
  return response.text();
}

export async function searchTabs(query) {
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
  const html = await fetchHtml(searchUrl);
  const store = extractJsStore(html);
  const fromStore = store ? collectSearchResults(store) : [];
  return fromStore.length ? fromStore : hrefResults(html);
}

export async function fetchTab(tabUrl) {
  const parsed = new URL(tabUrl);
  if (!SUPPORTED_HOSTS.has(parsed.hostname)) {
    throw new Error('unsupported url host');
  }
  const html = await fetchHtml(tabUrl);
  const store = extractJsStore(html);
  const parsedTab = store ? tabFromStore(store) : null;
  if (!parsedTab) {
    throw new Error('Could not read chart from Ultimate Guitar');
  }
  return parsedTab;
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': status === 200 ? 'public, max-age=120' : 'no-store',
    },
  });
}

export async function handleUgRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return jsonResponse({ ok: true, service: 'setlist-ultra-ug' });
  }

  try {
    if (url.pathname === '/search') {
      const q = url.searchParams.get('q') ?? '';
      if (!q.trim()) return jsonResponse({ error: 'q is required' }, 400);
      const results = await searchTabs(q.trim());
      return jsonResponse({ results });
    }

    if (url.pathname === '/tab') {
      const tabUrl = url.searchParams.get('url');
      if (!tabUrl) return jsonResponse({ error: 'url is required' }, 400);
      const tab = await fetchTab(tabUrl);
      return jsonResponse(tab);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'unknown error' }, 500);
  }

  return jsonResponse({ error: 'not found' }, 404);
}
