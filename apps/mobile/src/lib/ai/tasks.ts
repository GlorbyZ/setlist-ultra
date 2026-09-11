import { AiError } from './errors';
import { AI_PROMPT_VERSION } from './prompts';
import { wrapProposal, type ProposalEnvelope } from './proposal';
import { chatComplete } from './providers';
import { estimateSetDuration, searchLibrary } from './search';
import { isLiveSessionActive } from './stageGuard';
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

export type AiTaskType = 'chat' | 'build-set' | 'fix-chart' | 'clean-import' | 'ask-library';

export type AiTaskInput = {
  taskType: AiTaskType;
  provider: AiProviderId;
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  librarySongs?: LibrarySongRef[];
  chartConsent?: { songId: string; title: string; chordpro: string };
  signal?: AbortSignal;
  deadlineMs?: number;
  maxInputChars?: number;
  maxOutputTokens?: number;
  allowModelFallback?: boolean;
  preferByok?: boolean;
  requestId?: string;
};

export type AiTaskResult = {
  requestId: string;
  taskType: AiTaskType;
  provider: AiProviderId;
  model: string;
  usedFallback: boolean;
  truncated: boolean;
  hosted: boolean;
  text: string;
  proposal: ValidatedProposal | null;
  envelope: ProposalEnvelope | null;
  retrieved: LibrarySongRef[];
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

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i].content;
  }
  return '';
}

export function retrieveForTask(taskType: AiTaskType, library: LibrarySongRef[], userText: string): LibrarySongRef[] {
  const pool = library.slice(0, 400);
  if (taskType === 'chat') return pool.slice(0, AI_MAX_LIBRARY_SONGS);
  const hits = searchLibrary(pool, userText, { limit: 40 });
  if (hits.length) return hits;
  return pool.slice(0, AI_MAX_LIBRARY_SONGS);
}

export async function runAiTask(input: AiTaskInput): Promise<AiTaskResult> {
  const requestId = input.requestId?.trim() || newRequestId();
  const allowModelFallback = input.allowModelFallback ?? input.taskType === 'chat';
  const library = input.librarySongs ?? [];
  const retrieved = retrieveForTask(input.taskType, library, lastUserText(input.messages));
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
    preferByok: input.preferByok,
  });

  if (!completion.hosted && completion.provider !== input.provider) {
    throw new AiError('unknown', 'Provider switched without consent.');
  }

  let proposal: ValidatedProposal | null = null;
  let envelope: ProposalEnvelope | null = null;
  if (input.taskType !== 'chat') {
    try {
      const parsed = parseTaskProposal(input.taskType, completion.text, retrieved.length ? retrieved : library);
      proposal = parsed;
      const duration =
        parsed.kind === 'set' ? estimateSetDuration(parsed.songs) : { knownSeconds: 0, missingIds: [] as string[] };
      const expectedRevisions: Record<string, number> = {};
      if (parsed.kind === 'chart' && parsed.songId) {
        const songId = parsed.songId;
        const song = library.find((row) => row.id === songId);
        if (song?.localRevision != null) expectedRevisions[songId] = song.localRevision;
      }
      envelope = wrapProposal(parsed, {
        taskId: requestId,
        schemaVersion: AI_SCHEMA_VERSION,
        expectedRevisions,
        estimatedSeconds: duration.knownSeconds || undefined,
        missingDurationIds: duration.missingIds,
        assumptions: [
          isLiveSessionActive() ? 'Live is on stage; Apply is blocked until you leave Live.' : '',
          duration.missingIds.length ? `${duration.missingIds.length} song(s) have no stored duration.` : '',
        ].filter(Boolean),
      });
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
    hosted: Boolean(completion.hosted),
    text: completion.text,
    proposal,
    envelope,
    retrieved,
    promptVersion: AI_PROMPT_VERSION,
    schemaVersion: AI_SCHEMA_VERSION,
  };
}
