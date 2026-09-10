import { AiError } from './errors';
import { AI_PROMPT_VERSION } from './prompts';
import { chatComplete } from './providers';
import type { AiProviderId, ChatCompletionResult, ChatMessage } from './types';
import {
  AI_SCHEMA_VERSION,
  parseTaskProposal,
  type LibrarySongRef,
  type ValidatedProposal,
} from './validate';

export const AI_TASK_DEADLINE_MS = 45_000;
export const AI_MAX_INPUT_CHARS = 24_000;
export const AI_MAX_OUTPUT_TOKENS = 2048;
export const AI_MAX_LIBRARY_SONGS = 80;

export type AiTaskType = 'chat' | 'build-set' | 'fix-chart' | 'clean-import';

export type AiTaskInput = {
  taskType: AiTaskType;
  provider: AiProviderId;
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  librarySongs?: LibrarySongRef[];
  signal?: AbortSignal;
  deadlineMs?: number;
  maxInputChars?: number;
  maxOutputTokens?: number;
  allowModelFallback?: boolean;
  requestId?: string;
};

export type AiTaskResult = {
  requestId: string;
  taskType: AiTaskType;
  provider: AiProviderId;
  model: string;
  usedFallback: boolean;
  truncated: boolean;
  text: string;
  proposal: ValidatedProposal | null;
  promptVersion: string;
  schemaVersion: string;
};

function newRequestId() {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function enforceInputBudget(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  let used = 0;
  const out: ChatMessage[] = [];
  for (const message of messages) {
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    if (message.content.length <= remaining) {
      out.push(message);
      used += message.content.length;
    } else {
      out.push({ ...message, content: `${message.content.slice(0, remaining)}\n\n[truncated for input budget]` });
      break;
    }
  }
  if (!out.length) {
    throw new AiError('invalid_structure', 'Prompt was empty after applying the input budget.');
  }
  return out;
}

export async function runAiTask(input: AiTaskInput): Promise<AiTaskResult> {
  const requestId = input.requestId?.trim() || newRequestId();
  const allowModelFallback = input.allowModelFallback ?? input.taskType === 'chat';
  const messages = enforceInputBudget(input.messages, input.maxInputChars ?? AI_MAX_INPUT_CHARS);

  const completion: ChatCompletionResult = await chatComplete(input.provider, {
    apiKey: input.apiKey,
    model: input.model,
    messages,
    signal: input.signal,
    deadlineMs: input.deadlineMs ?? AI_TASK_DEADLINE_MS,
    maxOutputTokens: input.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS,
    allowModelFallback,
    requireComplete: input.taskType !== 'chat',
    temperature: input.taskType === 'chat' ? 0.7 : 0.2,
  });

  if (completion.provider !== input.provider) {
    throw new AiError('unknown', 'Provider switched without consent.');
  }

  let proposal: ValidatedProposal | null = null;
  if (input.taskType !== 'chat') {
    try {
      proposal = parseTaskProposal(input.taskType, completion.text, input.librarySongs ?? []);
    } catch (error) {
      if (error instanceof AiError) {
        throw new AiError(error.code, error.message, { rawText: completion.text, cause: error });
      }
      throw error;
    }
  }

  return {
    requestId,
    taskType: input.taskType,
    provider: completion.provider,
    model: completion.model,
    usedFallback: Boolean(completion.usedFallback),
    truncated: Boolean(completion.truncated),
    text: completion.text,
    proposal,
    promptVersion: AI_PROMPT_VERSION,
    schemaVersion: AI_SCHEMA_VERSION,
  };
}
