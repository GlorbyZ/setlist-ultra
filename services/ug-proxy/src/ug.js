const SUPPORTED_HOSTS = new Set(['tabs.ultimate-guitar.com', 'www.ultimate-guitar.com']);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value ?? '').replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, body) => {
    if (/^#x/i.test(body)) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named[body.toLowerCase()] ?? full;
  });
}

function decodeText(value) {
  return decodeEntities(decodeEntities(String(value ?? '')));
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
        lines.push({ type: 'lyric', lyric: decodeText(visible) });
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
    lines.push({ type: 'lyric', lyric: decodeText(line) });
  }

  return lines;
}

function hitFromNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const url = node.tab_url || node.tabUrl || node.url;
  if (typeof url !== 'string' || !url.includes('/tab/')) return null;
  const songName = decodeText(node.song_name || node.songName || '');
  if (!songName) return null;
  const artistName = decodeText(node.artist_name || node.artistName || '');
  const abs = url.startsWith('http') ? url : `https://tabs.ultimate-guitar.com${url.startsWith('/') ? '' : '/'}${url}`;
  const ratingRaw = Number(node.rating);
  const popularityRaw = Number(node.votes ?? node.hits ?? node.song_hit);
  return {
    title: [songName, artistName].filter(Boolean).join(' — '),
    url: abs,
    songName: String(songName),
    artistName: artistName ? String(artistName) : undefined,
    type: String(node.type || node.marketing_type || node.tab_type || '').trim() || undefined,
    rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : undefined,
    popularity: Number.isFinite(popularityRaw) && popularityRaw > 0 ? popularityRaw : undefined,
    key: node.tonality_name || node.tonalityName || undefined,
    songId: node.song_id != null ? String(node.song_id) : node.songId != null ? String(node.songId) : undefined,
  };
}

function collectSearchResults(store) {
  let best = [];
  let bestScore = 0;
  walk(store, (node) => {
    if (!Array.isArray(node) || node.length < 2) return;
    const hits = [];
    const songs = new Set();
    for (const item of node) {
      const hit = hitFromNode(item);
      if (!hit || String(hit.type ?? '').toLowerCase().includes('official')) continue;
      if (hits.some((row) => row.url === hit.url)) continue;
      hits.push(hit);
      songs.add(`${hit.songName}:::${hit.artistName ?? ''}`.toLowerCase());
    }
    const score = songs.size * 20 + hits.length;
    if (hits.length >= 2 && score > bestScore) {
      best = hits;
      bestScore = score;
    }
  });
  if (best.length) return best.slice(0, 120);

  const results = [];
  walk(store, (node) => {
    const hit = hitFromNode(node);
    if (!hit || String(hit.type ?? '').toLowerCase().includes('official')) return;
    if (results.some((row) => row.url === hit.url)) return;
    results.push(hit);
  });
  return results.slice(0, 120);
}

function groupKey(hit) {
  const song = String(hit.songName || hit.title || '').trim().toLowerCase();
  const artist = String(hit.artistName || '').trim().toLowerCase();
  return `${song}:::${artist}`;
}

function groupHits(hits) {
  const map = new Map();
  for (const hit of hits) {
    const id = groupKey(hit);
    const existing = map.get(id);
    if (existing) {
      if (!existing.versions.some((row) => row.url === hit.url)) existing.versions.push(hit);
    } else {
      map.set(id, {
        id,
        songName: hit.songName || hit.title,
        artistName: hit.artistName || '',
        versions: [hit],
      });
    }
  }
  const groups = [...map.values()].map((group) => {
    const rating = Math.max(0, ...group.versions.map((row) => row.rating ?? 0));
    const popularity = Math.max(0, ...group.versions.map((row) => row.popularity ?? 0));
    return { ...group, rating: rating || undefined, popularity: popularity || undefined };
  });
  groups.sort((a, b) => {
    if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
    if ((b.popularity ?? 0) !== (a.popularity ?? 0)) return (b.popularity ?? 0) - (a.popularity ?? 0);
    return String(a.songName).localeCompare(String(b.songName)) || String(a.artistName).localeCompare(String(b.artistName));
  });
  return groups;
}

function canonicalTabUrl(url) {
  try {
    const abs = url.startsWith('http') ? url : `https://tabs.ultimate-guitar.com${url.startsWith('/') ? '' : '/'}${url}`;
    const parsed = new URL(abs);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return String(url).split('?')[0].replace(/\/+$/, '').toLowerCase();
  }
}

function tabIdFromUrl(url) {
  const match = String(url).match(/-(\d+)(?:\/)?(?:[?#]|$)/);
  return match ? match[1] : null;
}

function nodeTabUrl(node) {
  const url = node.tab_url || node.tabUrl || node.url;
  if (typeof url !== 'string' || !url.includes('/tab/')) return '';
  return url.startsWith('http') ? url : `https://tabs.ultimate-guitar.com${url.startsWith('/') ? '' : '/'}${url}`;
}

function nodeHasWiki(node) {
  return typeof node.content === 'string' && node.content.includes('[ch]');
}

/** Bind metadata + wiki to the requested tab URL — never the last related song on the page. */
export function tabFromStore(store, requestedUrl) {
  const want = canonicalTabUrl(requestedUrl);
  const wantId = tabIdFromUrl(requestedUrl);
  let matched = null;
  let wiki = '';

  walk(store, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const abs = nodeTabUrl(node);
    const sameUrl = abs && canonicalTabUrl(abs) === want;
    const sameId =
      wantId &&
      (String(node.id ?? '') === wantId ||
        String(node.tab_id ?? '') === wantId ||
        (abs && tabIdFromUrl(abs) === wantId));
    if (!sameUrl && !sameId) return;
    matched = node;
    if (nodeHasWiki(node)) wiki = node.content;
  });

  if (matched && !wiki) {
    const id = matched.id ?? matched.tab_id;
    walk(store, (node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      if (!nodeHasWiki(node)) return;
      if (id != null && (node.id === id || node.tab_id === id)) wiki = node.content;
    });
  }

  if (!matched || !wiki) return null;
  const abs = nodeTabUrl(matched) || requestedUrl;
  return {
    requestedUrl,
    tab: {
      title: decodeText(matched.song_name || 'Imported chart'),
      artist_name: decodeText(matched.artist_name || ''),
      author: matched.username,
      key: matched.tonality_name,
      capo: matched.capo ? String(matched.capo) : undefined,
      tuning: Array.isArray(matched.tuning) ? matched.tuning.join(' ') : matched.tuning,
      difficulty: matched.difficulty,
      lines: wikiToLines(wiki),
      id: String(matched.id ?? wantId ?? ''),
      tab_url: abs,
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
  return results.slice(0, 120);
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

export async function searchTabs(query, page = 1) {
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}&page=${page}`;
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
  const parsedTab = store ? tabFromStore(store, tabUrl) : null;
  if (!parsedTab) {
    throw new Error('Could not read chart from Ultimate Guitar');
  }
  return parsedTab;
}

export function jsonResponse(body, status = 200, cache = true) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': status === 200 && cache ? 'public, max-age=120' : 'no-store',
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
      const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
      const pageSize = Math.min(40, Math.max(5, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
      const hits = await searchTabs(q.trim(), page);
      const groups = groupHits(hits);
      const nextPage = hits.length >= 8 ? page + 1 : null;
      return jsonResponse({
        results: hits,
        songs: groups,
        page,
        pageSize,
        nextPage,
        sort: 'rating,popularity',
      });
    }

    if (url.pathname === '/tab') {
      const tabUrl = url.searchParams.get('url');
      if (!tabUrl) return jsonResponse({ error: 'url is required' }, 400);
      const tab = await fetchTab(tabUrl);
      return jsonResponse(tab, 200, false);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'unknown error' }, 500);
  }

  return jsonResponse({ error: 'not found' }, 404);
}
