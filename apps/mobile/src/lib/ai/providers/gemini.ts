import {
  GEMINI_DEFAULT_MODEL,
  isGeminiModelUnavailableError,
  modelCandidates,
  parseSuggestedGeminiModel,
} from '../models';
import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult, ChatMessage } from '../types';

function toGeminiContents(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${msg.content}`;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires the first turn to be a user message.
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] });
  }

  return {
    systemInstruction: systemParts.length
      ? { parts: [{ text: systemParts.join('\n\n') }] }
      : undefined,
    contents,
  };
}

async function generateOnce(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
): Promise<ChatCompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = toGeminiContents(messages);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      generationConfig: {
        temperature,
      },
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Gemini request failed (${res.status})`);
  }

  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? '';

  if (!text) throw new Error('Gemini returned an empty response.');

  return { text, model, provider: 'gemini' };
}

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const preferred = req.model?.trim() || GEMINI_DEFAULT_MODEL;
  const candidates = modelCandidates('gemini', preferred);
  const tried = new Set<string>();
  let lastError: Error | null = null;
  let suggestedRetryUsed = false;

  while (true) {
    const next = candidates.find((id) => !tried.has(id));
    if (!next) break;
    tried.add(next);

    try {
      return await generateOnce(req.apiKey, next, req.messages, req.temperature ?? 0.7);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);

      if (!isGeminiModelUnavailableError(message)) {
        throw lastError;
      }

      // Prefer Google's suggested models/<id> once, then continue fallback walk.
      if (!suggestedRetryUsed) {
        const suggested = parseSuggestedGeminiModel(message);
        if (suggested && !tried.has(suggested)) {
          suggestedRetryUsed = true;
          candidates.unshift(suggested);
        }
      }
    }
  }

  throw lastError ?? new Error('Gemini request failed (no model available).');
}

export const geminiClient: AiChatClient = {
  provider: 'gemini',
  complete,
};