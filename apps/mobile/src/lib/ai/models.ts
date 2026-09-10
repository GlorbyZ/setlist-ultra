/**
 * Central AI model defaults + fallback chains (BYOK).
 *
 * Docs checked 2026-09-10:
 * - Gemini models: https://ai.google.dev/gemini-api/docs/models
 * - Gemini deprecations: https://ai.google.dev/gemini-api/docs/deprecations
 * - OpenAI models: https://platform.openai.com/docs/models
 * - Anthropic models: https://docs.anthropic.com/en/docs/about-claude/models
 *
 * gemini-2.0-flash / gemini-2.0-flash-lite shut down (Jun 1 2026). Never use them.
 * Prefer pinned gemini-3.8-flash for BYOK reliability; alias gemini-flash-latest is
 * in the fallback chain and may hot-swap to the newest Flash release.
 */

import type { AiProviderId } from './types';

/** Newest stable Flash pin — preferred BYOK default over the moving alias. */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

/**
 * Walked on model-unavailable errors (after optional parse of suggested models/<id>).
 * Order: alias → newest pins → older still-supported Flash.
 */
export const GEMINI_FALLBACK_MODELS: readonly string[] = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
] as const;

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
export const OPENAI_FALLBACK_MODELS: readonly string[] = ['gpt-4o-mini', 'gpt-4o'] as const;

/** Anthropic Haiku 4.5 alias (docs 2026); dated id also accepted by API. */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5';
export const ANTHROPIC_FALLBACK_MODELS: readonly string[] = [
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
] as const;

export function defaultModelFor(provider: AiProviderId): string {
  switch (provider) {
    case 'gemini':
      return GEMINI_DEFAULT_MODEL;
    case 'openai':
      return OPENAI_DEFAULT_MODEL;
    case 'anthropic':
      return ANTHROPIC_DEFAULT_MODEL;
  }
}

export function fallbackModelsFor(provider: AiProviderId): readonly string[] {
  switch (provider) {
    case 'gemini':
      return GEMINI_FALLBACK_MODELS;
    case 'openai':
      return OPENAI_FALLBACK_MODELS;
    case 'anthropic':
      return ANTHROPIC_FALLBACK_MODELS;
  }
}

/** Unique candidate list: preferred first, then provider fallbacks. */
export function modelCandidates(provider: AiProviderId, preferred?: string | null): string[] {
  const primary = preferred?.trim() || defaultModelFor(provider);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [primary, ...fallbackModelsFor(provider)]) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Parse Google's "update … to models/<id>" (or bare models/<id>) suggestion.
 * Returns the bare model id without the models/ prefix, or null.
 */
export function parseSuggestedGeminiModel(errorMessage: string): string | null {
  const m = errorMessage.match(/models\/([a-zA-Z0-9._-]+)/);
  if (!m?.[1]) return null;
  const id = m[1];
  // Ignore the dead 2.0 family even if somehow suggested.
  if (id.startsWith('gemini-2.0')) return null;
  return id;
}

export function isGeminiModelUnavailableError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('no longer available') ||
    lower.includes('not found') ||
    lower.includes('is not found') ||
    lower.includes('not supported') ||
    (lower.includes('model') && lower.includes('unavailable')) ||
    lower.includes('please update')
  );
}