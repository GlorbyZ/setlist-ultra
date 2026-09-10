/** Shared AI chat types — BYOK, never log keys. */

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
    defaultModel: 'gemini-2.0-flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-… from platform.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyHint: 'sk-ant-… from console.anthropic.com',
    defaultModel: 'claude-3-5-haiku-latest',
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
