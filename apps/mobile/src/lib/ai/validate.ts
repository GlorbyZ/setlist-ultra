import { parseChordPro } from '@setlist-ultra/core';

import { AiError } from './errors';

export const AI_SCHEMA_VERSION = 'ai-proposals.v2';

export type LibrarySongRef = {
  id: string;
  title: string;
  artist: string;
  durationSeconds?: number | null;
  tags?: string | null;
  originalKey?: string | null;
  localRevision?: number;
};

export type SetProposal = {
  type: 'set-proposal';
  title: string;
  songIds: string[];
  uncertain?: boolean;
  notes?: string;
};

export type ChartPatch = {
  type: 'chart-patch';
  songId?: string;
  chordpro: string;
  uncertain?: boolean;
  notes?: string;
};

export type ValidatedSetProposal = {
  kind: 'set';
  title: string;
  songIds: string[];
  songs: LibrarySongRef[];
  inventedIds: string[];
  uncertain: boolean;
  notes?: string;
};

export type ValidatedChartPatch = {
  kind: 'chart';
  songId?: string;
  title?: string;
  artist?: string;
  chordpro: string;
  uncertain: boolean;
  notes?: string;
};

export type ValidatedLibraryAnswer = {
  kind: 'library';
  songIds: string[];
  songs: LibrarySongRef[];
  inventedIds: string[];
  uncertain: boolean;
  notes?: string;
};

export type ValidatedProposal = ValidatedSetProposal | ValidatedChartPatch | ValidatedLibraryAnswer;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError('invalid_structure', 'The model did not return valid JSON.', { rawText: text });
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function validateSetProposal(raw: unknown, library: LibrarySongRef[]): ValidatedSetProposal {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!obj || (obj.type !== 'set-proposal' && obj.kind !== 'set')) {
    throw new AiError('invalid_structure', 'Expected a set-proposal object.');
  }
  const title = asString(obj.title) || 'AI set';
  const idsRaw = Array.isArray(obj.songIds) ? obj.songIds : [];
  const songIds = idsRaw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim());
  if (!songIds.length) {
    throw new AiError('invalid_structure', 'Set proposal listed no song IDs.');
  }

  const byId = new Map(library.map((song) => [song.id, song]));
  const inventedIds = songIds.filter((id) => !byId.has(id));
  const knownIds = songIds.filter((id) => byId.has(id));
  if (!knownIds.length) {
    throw new AiError('invalid_structure', 'Set proposal only referenced songs that are not in this library.');
  }

  const songs = knownIds.map((id) => byId.get(id)!);
  const uncertain = Boolean(obj.uncertain) || inventedIds.length > 0;
  return {
    kind: 'set',
    title,
    songIds: knownIds,
    songs,
    inventedIds,
    uncertain,
    notes: asString(obj.notes),
  };
}

export function validateLibraryAnswer(raw: unknown, library: LibrarySongRef[]): ValidatedLibraryAnswer {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!obj || (obj.type !== 'library-answer' && obj.kind !== 'library')) {
    throw new AiError('invalid_structure', 'Expected a library-answer object.');
  }
  const idsRaw = Array.isArray(obj.songIds) ? obj.songIds : [];
  const songIds = idsRaw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim());
  const byId = new Map(library.map((song) => [song.id, song]));
  const inventedIds = songIds.filter((id) => !byId.has(id));
  const knownIds = songIds.filter((id) => byId.has(id));
  return {
    kind: 'library',
    songIds: knownIds,
    songs: knownIds.map((id) => byId.get(id)!),
    inventedIds,
    uncertain: Boolean(obj.uncertain) || inventedIds.length > 0 || !knownIds.length,
    notes: asString(obj.notes),
  };
}

export function validateChartPatch(raw: unknown, library: LibrarySongRef[]): ValidatedChartPatch {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!obj || (obj.type !== 'chart-patch' && obj.kind !== 'chart')) {
    throw new AiError('invalid_structure', 'Expected a chart-patch object.');
  }
  const chordpro = asString(obj.chordpro);
  if (!chordpro) {
    throw new AiError('invalid_structure', 'Chart patch was missing ChordPro text.');
  }
  const parsed = parseChordPro(chordpro);
  const hasMusic =
    parsed.document.sections.some((section) =>
      section.lines.some((line) => (line.slots && line.slots.length > 0) || Boolean(line.lyric?.trim())),
    ) || /\[[A-G][#b]?/.test(chordpro);
  if (!hasMusic) {
    throw new AiError('invalid_structure', 'Chart patch did not contain recognizable chords or lyrics.');
  }

  const songId = asString(obj.songId);
  const match = songId ? library.find((song) => song.id === songId) : undefined;
  if (songId && !match) {
    throw new AiError('invalid_structure', 'Chart patch referenced a song that is not in this library.');
  }

  return {
    kind: 'chart',
    songId: match?.id,
    title: match?.title ?? parsed.meta.title,
    artist: match?.artist ?? parsed.meta.artist,
    chordpro,
    uncertain: Boolean(obj.uncertain),
    notes: asString(obj.notes),
  };
}

export function parseTaskProposal(
  taskType: 'build-set' | 'fix-chart' | 'clean-import' | 'ask-library',
  text: string,
  library: LibrarySongRef[],
): ValidatedProposal {
  const raw = extractJsonObject(text);
  if (taskType === 'build-set') return validateSetProposal(raw, library);
  if (taskType === 'ask-library') return validateLibraryAnswer(raw, library);
  return validateChartPatch(raw, library);
}
