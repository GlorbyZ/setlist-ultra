import { createServer } from 'node:http';
import { handleUgRequest } from './ug.js';

const PORT = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const request = new Request(`http://${host}${req.url ?? '/'}`, {
    method: req.method,
    headers: req.headers,
  });

  const response = await handleUgRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, () => {
  console.log(`UG proxy listening on http://localhost:${PORT}`);
});
