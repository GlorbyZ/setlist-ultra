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
  return getChatClient(provider).complete(req);
}

export { geminiClient, openaiClient, anthropicClient };
