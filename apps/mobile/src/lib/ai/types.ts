/** Shared AI chat types — BYOK, never log keys. */

import {
  ANTHROPIC_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
} from './models';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export const AI_PROVIDERS: readonly {
  id: AiProviderId;
  label: string;
  keyHint: string;
  defaultModel: string;
}[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyHint: 'AIza… from Google AI Studio',
    defaultModel: GEMINI_DEFAULT_MODEL,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-… from platform.openai.com',
    defaultModel: OPENAI_DEFAULT_MODEL,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyHint: 'sk-ant-… from console.anthropic.com',
    defaultModel: ANTHROPIC_DEFAULT_MODEL,
  },
] as const;

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionRequest = {
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
};

export type ChatCompletionResult = {
  text: string;
  model: string;
  provider: AiProviderId;
};

export type AiChatClient = {
  provider: AiProviderId;
  complete: (req: ChatCompletionRequest) => Promise<ChatCompletionResult>;
};