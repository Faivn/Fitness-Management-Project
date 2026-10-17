/**
 * Local development server: serves the same handler as the Vercel Function at
 * http://localhost:3000/api/v1/*. Reads apps/api/.env (never committed).
 */
import { createServer } from 'node:http';
import { handleRequest } from './app.js';

const port = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${port}${req.url ?? '/'}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = await handleRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body && /ndjson/.test(response.headers.get('content-type') ?? '')) {
    // Streaming route: forward chunks as they arrive.
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`Mova API listening on http://localhost:${port}/api/v1`);
});
