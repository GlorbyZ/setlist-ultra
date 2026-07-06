import { createServer } from 'node:http';
import { URL } from 'node:url';
import * as cheerio from 'cheerio';

const PORT = Number(process.env.PORT ?? 8787);
const SUPPORTED_HOST = 'tabs.ultimate-guitar.com';

function parseChordLine(line) {
  const chords = [];
  let leadingSpaces = 0;

  for (const part of line.split(' ')) {
    if (!part) {
      leadingSpaces += 1;
    } else {
      chords.push({ note: part, pre_spaces: leadingSpaces });
      leadingSpaces = 1;
    }
  }

  return chords;
}

function parseTabHtml(html) {
  const $ = cheerio.load(html);

  let title = 'UNKNOWN';
  const titleEl = $('[itemprop="name"]').first();
  if (titleEl.length) {
    title = titleEl.text().replace(/chords/gi, '').trim();
  }

  let artist = 'UNKNOWN';
  const artistEl = $('.t_autor').first();
  if (artistEl.length) {
    artist = artistEl.text().replace(/\n/g, '').replace(/by/gi, '').trim();
  }

  let author = 'UNKNOWN';
  let key;
  let capo;
  let tuning;
  let difficulty;

  const infoHeader = $('.t_dt').first().text().replace(/\n/g, '');
  const headers = infoHeader.split(' ').filter(Boolean).map((h) => h.toLowerCase());
  const values = $('.t_dtde');

  headers.forEach((header, index) => {
    const valueEl = values.eq(index);
    if (!valueEl.length) return;

    if (header === 'author') {
      author = valueEl.find('a').first().text() || valueEl.text().trim();
    } else if (header === 'key') {
      key = valueEl.text().trim();
    } else if (header === 'capo') {
      capo = valueEl.text().trim();
    } else if (header === 'tuning') {
      tuning = valueEl.text().trim();
    } else if (header === 'difficulty') {
      difficulty = valueEl.text().trim();
    }
  });

  const pre = $('pre').first();
  const lines = [];

  if (pre.length) {
    const content = pre.html() ?? '';
    const textLines = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n');

    for (const rawLine of textLines) {
      const line = rawLine.replace(/\r/g, '');
      if (!line.trim()) {
        lines.push({ type: 'blank' });
        continue;
      }

      const spanMatch = /<span/i.test(rawLine);
      if (spanMatch) {
        const sanitized = line.replace(/<span[^>]*>|<\/span>/gi, ' ');
        lines.push({ type: 'chords', chords: parseChordLine(sanitized) });
      } else {
        lines.push({ type: 'lyric', lyric: line });
      }
    }
  }

  const tab = {
    title,
    artist_name: artist,
    author,
    lines,
  };

  if (key) tab.key = key;
  if (capo) tab.capo = capo;
  if (tuning) tab.tuning = tuning;
  if (difficulty) tab.difficulty = difficulty;

  return { tab };
}

async function fetchTab(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SetlistUltra/0.1 (dev proxy)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tab: ${response.status}`);
  }

  const html = await response.text();
  return parseTabHtml(html);
}

async function searchTabs(query) {
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'SetlistUltra/0.1 (dev proxy)',
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('a[href*="tabs.ultimate-guitar.com/tab/"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (!href || !text) return;

    const url = href.startsWith('http') ? href : `https://www.ultimate-guitar.com${href}`;
    if (results.some((r) => r.url === url)) return;

    results.push({
      title: text,
      url,
    });
  });

  return results.slice(0, 20);
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === '/search') {
      const q = url.searchParams.get('q') ?? '';
      if (!q.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'q is required' }));
        return;
      }

      const results = await searchTabs(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
      return;
    }

    if (url.pathname === '/tab') {
      const tabUrl = url.searchParams.get('url');
      if (!tabUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'url is required' }));
        return;
      }

      const parsed = new URL(tabUrl);
      if (parsed.hostname !== SUPPORTED_HOST) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unsupported url host' }));
        return;
      }

      const tab = await fetchTab(tabUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tab));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown error' }));
  }
});

server.listen(PORT, () => {
  console.log(`UG proxy listening on http://localhost:${PORT}`);
});
