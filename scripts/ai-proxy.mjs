/**
 * Local stand-in for the deployed /api/ai endpoint, so the live AI can be tried against a local build.
 * It reads GROQ_* from apps/api/.env (values are never printed), or from the environment.
 *   node scripts/ai-proxy.mjs
 *   then, in the local app's browser console: localStorage["mova.aiUrl"]="http://localhost:8787/api/ai"; location.reload()
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

try {
  const text = readFileSync(fileURLToPath(new URL('../apps/api/.env', import.meta.url)), 'utf8');
  for (const line of text.split('\n')) {
    const m = /^\s*(GROQ_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // no apps/api/.env: rely on the environment
}
const { default: handler } = await import('../api/ai.mjs');

createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  handler(req, res);
}).listen(8787, () => console.log(`AI proxy on http://localhost:8787/api/ai (${process.env.GROQ_API_KEY ? 'Groq key found' : 'NO KEY: will answer 503'})`));
