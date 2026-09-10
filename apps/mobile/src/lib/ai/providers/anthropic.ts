import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult } from '../types';

const DEFAULT_MODEL = 'claude-3-5-haiku-latest';

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const model = req.model?.trim() || DEFAULT_MODEL;
  const system = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const messages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: req.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages,
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    content?: { type?: string; text?: string }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Anthropic request failed (${res.status})`);
  }

  const text =
    json.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim() ?? '';

  if (!text) throw new Error('Anthropic returned an empty response.');

  return { text, model, provider: 'anthropic' };
}

export const anthropicClient: AiChatClient = {
  provider: 'anthropic',
  complete,
};
