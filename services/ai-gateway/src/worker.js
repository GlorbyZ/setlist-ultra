const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-setlist-ultra',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'gpt-4o-mini';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function toOpenAiMessages(messages) {
  const out = [];
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') continue;
    if (msg.role !== 'system' && msg.role !== 'user' && msg.role !== 'assistant') continue;
    const last = out[out.length - 1];
    if (last && last.role === msg.role) {
      last.content += `\n\n${msg.content}`;
    } else {
      out.push({ role: msg.role, content: msg.content });
    }
  }
  return out;
}

async function complete(apiKey, payload) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: payload.temperature ?? 0.2,
      max_tokens: Math.min(payload.maxOutputTokens ?? 2048, 4096),
      response_format: { type: 'json_object' },
      messages: toOpenAiMessages(payload.messages),
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json(405, { error: 'POST only' });

    const url = new URL(request.url);
    if (url.pathname !== '/v1/complete' && url.pathname !== '/') {
      return json(404, { error: 'Not found' });
    }

    const expected = env.GATEWAY_TOKEN?.trim();
    if (expected) {
      const got = request.headers.get('x-setlist-ultra')?.trim();
      if (got !== expected) return json(401, { error: 'Unauthorized' });
    }

    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) return json(503, { error: 'Assistant is temporarily unavailable.' });

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    if (!Array.isArray(payload?.messages) || payload.messages.length > 24) {
      return json(400, { error: 'Invalid messages' });
    }

    const { status, body } = await complete(apiKey, payload);
    if (status >= 400) {
      const clientStatus = status === 429 ? 429 : status >= 500 ? 503 : 502;
      return json(clientStatus, { error: 'Assistant is temporarily busy.' });
    }
    const text = body?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return json(502, { error: 'Assistant is temporarily busy.' });
    return json(200, {
      text,
      model: body?.model || MODEL,
      provider: 'openai',
      hosted: true,
    });
  },
};
