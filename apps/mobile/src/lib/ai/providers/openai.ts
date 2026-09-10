import { OPENAI_DEFAULT_MODEL, modelCandidates } from '../models';
import { AiError, classifyProviderMessage } from '../errors';
import { fetchJson, safeErrorMessage, withDeadline } from '../http';
import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult, ChatFinishReason } from '../types';

function mapFinishReason(reason: string | undefined): ChatFinishReason {
  if (reason === 'length') return 'max_tokens';
  if (reason === 'content_filter') return 'safety';
  if (reason === 'stop') return 'stop';
  return 'other';
}

type OpenAiResponse = {
  error?: { message?: string };
  choices?: { finish_reason?: string; message?: { content?: string } }[];
};

async function completeOnce(req: ChatCompletionRequest, model: string): Promise<ChatCompletionResult> {
  const deadline = withDeadline(req.signal, req.deadlineMs ?? 45_000);
  try {
    const { status, json } = await fetchJson<OpenAiResponse>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxOutputTokens ?? 2048,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: deadline.signal,
    });

    if (status >= 400) {
      const message = safeErrorMessage(status, json.error?.message);
      throw new AiError(classifyProviderMessage(message, status), message, { status });
    }

    const choice = json.choices?.[0];
    const finishReason = mapFinishReason(choice?.finish_reason);
    const text = choice?.message?.content?.trim() ?? '';
    if (finishReason === 'safety') {
      throw new AiError('safety', 'OpenAI refused this request.');
    }
    if (!text) throw new AiError('unknown', 'OpenAI returned an empty response.');
    if (finishReason === 'max_tokens') {
      if (req.requireComplete) {
        throw new AiError('truncated', 'OpenAI truncated the response before it was complete.', { rawText: text });
      }
      return { text, model, provider: 'openai', finishReason, truncated: true };
    }
    return { text, model, provider: 'openai', finishReason };
  } finally {
    deadline.dispose();
  }
}

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const preferred = req.model?.trim() || OPENAI_DEFAULT_MODEL;
  const allowFallback = req.allowModelFallback === true;
  const candidates = allowFallback ? modelCandidates('openai', preferred) : [preferred];
  let lastError: Error | null = null;

  for (const model of candidates) {
    try {
      const result = await completeOnce(req, model);
      return { ...result, usedFallback: model !== preferred };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!allowFallback) throw lastError;
    }
  }

  throw lastError ?? new AiError('unknown', 'OpenAI request failed.');
}

export const openaiClient: AiChatClient = {
  provider: 'openai',
  complete,
};
