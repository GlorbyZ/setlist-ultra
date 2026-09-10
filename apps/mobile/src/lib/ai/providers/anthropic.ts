import { ANTHROPIC_DEFAULT_MODEL, modelCandidates } from '../models';
import { AiError, classifyProviderMessage } from '../errors';
import { fetchJson, safeErrorMessage, withDeadline } from '../http';
import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult, ChatFinishReason } from '../types';

function mapFinishReason(reason: string | undefined): ChatFinishReason {
  if (reason === 'max_tokens') return 'max_tokens';
  if (reason === 'refusal') return 'safety';
  if (reason === 'end_turn' || reason === 'stop_sequence') return 'stop';
  return 'other';
}

type AnthropicResponse = {
  error?: { message?: string };
  stop_reason?: string;
  content?: { type?: string; text?: string }[];
};

async function completeOnce(req: ChatCompletionRequest, model: string): Promise<ChatCompletionResult> {
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

  const deadline = withDeadline(req.signal, req.deadlineMs ?? 45_000);
  try {
    const { status, json } = await fetchJson<AnthropicResponse>('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxOutputTokens ?? 2048,
        temperature: req.temperature ?? 0.7,
        ...(system ? { system } : {}),
        messages,
      }),
      signal: deadline.signal,
    });

    if (status >= 400) {
      const message = safeErrorMessage(status, json.error?.message);
      throw new AiError(classifyProviderMessage(message, status), message, { status });
    }

    const finishReason = mapFinishReason(json.stop_reason);
    const text =
      json.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim() ?? '';

    if (finishReason === 'safety') {
      throw new AiError('safety', 'Anthropic refused this request.');
    }
    if (!text) throw new AiError('unknown', 'Anthropic returned an empty response.');
    if (finishReason === 'max_tokens') {
      if (req.requireComplete) {
        throw new AiError('truncated', 'Anthropic truncated the response before it was complete.', { rawText: text });
      }
      return { text, model, provider: 'anthropic', finishReason, truncated: true };
    }
    return { text, model, provider: 'anthropic', finishReason };
  } finally {
    deadline.dispose();
  }
}

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const preferred = req.model?.trim() || ANTHROPIC_DEFAULT_MODEL;
  const allowFallback = req.allowModelFallback === true;
  const candidates = allowFallback ? modelCandidates('anthropic', preferred) : [preferred];
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

  throw lastError ?? new AiError('unknown', 'Anthropic request failed.');
}

export const anthropicClient: AiChatClient = {
  provider: 'anthropic',
  complete,
};
