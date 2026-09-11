import { AiError } from '../errors';
import type { AiChatClient, AiProviderId, ChatCompletionRequest, ChatCompletionResult } from '../types';
import { anthropicClient } from './anthropic';
import { geminiClient } from './gemini';
import { openaiClient } from './openai';

const CLIENTS: Record<AiProviderId, AiChatClient> = {
  gemini: geminiClient,
  openai: openaiClient,
  anthropic: anthropicClient,
};

export function getChatClient(provider: AiProviderId): AiChatClient {
  return CLIENTS[provider];
}

export async function chatComplete(
  provider: AiProviderId,
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  if (!req.preferByok) {
    const { hostedComplete, shouldUseHostedGateway } = await import('../hosted');
    if (shouldUseHostedGateway()) return hostedComplete(req);
  }
  if (!req.apiKey?.trim()) {
    throw new AiError('invalid_key', 'Add an API key in Settings → Assistant, or use the hosted assistant.');
  }
  return getChatClient(provider).complete(req);
}

export { geminiClient, openaiClient, anthropicClient };
