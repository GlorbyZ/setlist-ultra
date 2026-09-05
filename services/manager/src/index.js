import http from 'node:http';

const PORT = Number(process.env.MANAGER_PORT ?? 3848);

let payload = {
  updatedAt: null,
  snapshot: null,
  library: null,
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, updatedAt: payload.updatedAt }));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/library')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/library') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        payload = {
          updatedAt: new Date().toISOString(),
          snapshot: body.snapshot ?? null,
          library: body.library ?? null,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, updatedAt: payload.updatedAt }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Setlist Ultra Manager host http://127.0.0.1:${PORT}`);
  console.log('Point a browser at this URL, then push a library from the app Settings → LAN Manager.');
});
