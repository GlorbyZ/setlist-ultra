import { config, isAiGatewayConfigured } from '@/src/lib/config';

import { AiError, classifyProviderMessage } from './errors';
import { fetchJson, withDeadline } from './http';
import type { AiProviderId, ChatCompletionRequest, ChatCompletionResult } from './types';

function hostedProvider(value: unknown): AiProviderId {
  return value === 'openai' || value === 'anthropic' || value === 'gemini' ? value : 'openai';
}

type GatewayResponse = {
  text?: string;
  model?: string;
  provider?: string;
  hosted?: boolean;
  error?: string;
};

export async function hostedComplete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const base = config.aiGatewayUrl.replace(/\/$/, '');
  const deadline = withDeadline(req.signal, req.deadlineMs ?? 45_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.aiGatewayToken) headers['x-setlist-ultra'] = config.aiGatewayToken;
    const { status, json } = await fetchJson<GatewayResponse>(
      `${base}/v1/complete`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: req.messages,
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
        }),
        signal: deadline.signal,
      },
      { timeoutMessage: 'Assistant timed out.' },
    );
    if (status >= 400) {
      const code = classifyProviderMessage(json.error || '', status);
      const friendly =
        status === 401 || status === 403
          ? 'Assistant is temporarily busy.'
          : status === 429
            ? 'Assistant is busy. Wait a moment and try again.'
            : json.error || 'Assistant is temporarily busy.';
      throw new AiError(code === 'invalid_key' ? 'unknown' : code, friendly, { status });
    }
    const text = json.text?.trim() ?? '';
    if (!text) throw new AiError('unknown', 'Assistant returned an empty response.');
    return {
      text,
      model: json.model || 'hosted',
      provider: hostedProvider(json.provider),
      hosted: true,
    };
  } finally {
    deadline.dispose();
  }
}

export function shouldUseHostedGateway(): boolean {
  return isAiGatewayConfigured();
}
