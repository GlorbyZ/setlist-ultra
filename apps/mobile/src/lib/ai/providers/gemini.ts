import { AiError, classifyProviderMessage, redactSecrets } from '../errors';
import { assertNoKeyInUrl, fetchJson, safeErrorMessage, withDeadline } from '../http';
import {
  GEMINI_DEFAULT_MODEL,
  isGeminiModelUnavailableError,
  modelCandidates,
  parseSuggestedGeminiModel,
} from '../models';
import type {
  AiChatClient,
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatFinishReason,
  ChatMessage,
} from '../types';

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

function mapFinishReason(reason: string | undefined): ChatFinishReason {
  const upper = (reason ?? '').toUpperCase();
  if (upper === 'MAX_TOKENS') return 'max_tokens';
  if (upper === 'SAFETY' || upper === 'RECITATION' || upper === 'BLOCKED') return 'safety';
  if (upper === 'STOP' || upper === 'END_TURN') return 'stop';
  return 'other';
}

type GeminiResponse = {
  error?: { message?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
  promptFeedback?: { blockReason?: string };
};

async function generateOnce(
  req: ChatCompletionRequest,
  model: string,
): Promise<ChatCompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  assertNoKeyInUrl(url);
  const body = toGeminiContents(req.messages);
  const deadline = withDeadline(req.signal, req.deadlineMs ?? 45_000);

  try {
    const { status, json } = await fetchJson<GeminiResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': req.apiKey,
      },
      body: JSON.stringify({
        ...body,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxOutputTokens ?? 2048,
        },
      }),
      signal: deadline.signal,
    });

    if (status >= 400) {
      const message = safeErrorMessage(status, json.error?.message);
      throw new AiError(classifyProviderMessage(message, status), message, { status });
    }

    if (json.promptFeedback?.blockReason) {
      throw new AiError('safety', `Gemini blocked the prompt (${json.promptFeedback.blockReason}).`);
    }

    const candidate = json.candidates?.[0];
    const finishReason = mapFinishReason(candidate?.finishReason);
    const text =
      candidate?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    if (finishReason === 'safety') {
      throw new AiError('safety', 'Gemini refused this request.');
    }
    if (!text) {
      throw new AiError('unknown', 'Gemini returned an empty response.');
    }
    if (finishReason === 'max_tokens') {
      if (req.requireComplete) {
        throw new AiError('truncated', 'Gemini truncated the response before it was complete.', { rawText: text });
      }
      return { text, model, provider: 'gemini', finishReason, truncated: true };
    }

    return { text, model, provider: 'gemini', finishReason };
  } finally {
    deadline.dispose();
  }
}

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const preferred = req.model?.trim() || GEMINI_DEFAULT_MODEL;
  const allowFallback = req.allowModelFallback !== false;
  const candidates = allowFallback ? modelCandidates('gemini', preferred) : [preferred];
  const tried = new Set<string>();
  let lastError: Error | null = null;
  let suggestedRetryUsed = false;

  while (true) {
    const next = candidates.find((id) => !tried.has(id));
    if (!next) break;
    tried.add(next);

    try {
      const result = await generateOnce(req, next);
      return { ...result, usedFallback: next !== preferred };
    } catch (err) {
      const message = redactSecrets(err instanceof Error ? err.message : String(err));
      lastError = err instanceof Error ? err : new Error(message);

      if (!allowFallback || !isGeminiModelUnavailableError(message)) {
        throw lastError;
      }

      if (!suggestedRetryUsed) {
        const suggested = parseSuggestedGeminiModel(message);
        if (suggested && !tried.has(suggested)) {
          suggestedRetryUsed = true;
          candidates.unshift(suggested);
        }
      }
    }
  }

  throw lastError ?? new AiError('unavailable_model', 'Gemini request failed (no model available).');
}

export const geminiClient: AiChatClient = {
  provider: 'gemini',
  complete,
};
