import { OPENAI_DEFAULT_MODEL } from '../models';
import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult } from '../types';

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const model = req.model?.trim() || OPENAI_DEFAULT_MODEL;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `OpenAI request failed (${res.status})`);
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('OpenAI returned an empty response.');

  return { text, model, provider: 'openai' };
}

export const openaiClient: AiChatClient = {
  provider: 'openai',
  complete,
};