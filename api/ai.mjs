/**
 * Server endpoint for the companion's live AI (Groq, OpenAI-compatible Chat Completions). The key
 * (GROQ_API_KEY) lives only in the server environment, never in the app bundle. Without it this answers 503.
 *
 * POST /api/ai  { name, messages: [{role, content}], schema, temperature? }  ->  { text }
 */
const BASE_URL = (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 45_000;
const MAX_BODY = 200_000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('too large');
  }
  return JSON.parse(raw || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return send(res, 503, { error: 'not_configured' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad_request' });
  }
  const { name, messages, schema, temperature } = body;
  const roles = new Set(['system', 'user', 'assistant']);
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60 || !messages.every((m) => roles.has(m?.role))) {
    return send(res, 400, { error: 'bad_request' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: messages.map((m) => ({ role: m.role, content: String(m.content).slice(0, 20_000) })),
        // Long outputs (a 7-day meal plan) are cut off by a small default cap, which leaves the last days empty.
        max_completion_tokens: 12000,
        temperature: typeof temperature === 'number' ? Math.min(1, Math.max(0, temperature)) : 0.4,
        ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: String(name || 'reply').slice(0, 60), strict: false, schema } } } : {}),
      }),
    });
    if (r.status === 401 || r.status === 403) return send(res, 401, { error: 'auth_failed' });
    if (r.status === 429) return send(res, 429, { error: 'rate_limited' });
    if (r.status === 400) return send(res, 422, { error: 'invalid_output' });
    if (!r.ok) return send(res, 502, { error: 'provider_error' });
    const data = await r.json();
    // A reply that hit the length cap is incomplete JSON: report it as invalid so the caller retries.
    if (data.choices?.[0]?.finish_reason === 'length') return send(res, 422, { error: 'invalid_output' });
    return send(res, 200, { text: data.choices?.[0]?.message?.content ?? '' });
  } catch {
    return send(res, 502, { error: 'provider_error' });
  } finally {
    clearTimeout(timer);
  }
}
