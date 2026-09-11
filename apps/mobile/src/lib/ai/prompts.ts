import type { ChatMessage } from './types';
import { AI_SCHEMA_VERSION, type LibrarySongRef } from './validate';

export const AI_PROMPT_VERSION = 'ai-tasks.v2';

export type AiActionId = 'build-set' | 'fix-chart' | 'clean-import' | 'ask-library';

export type AiActionCard = {
  id: AiActionId;
  title: string;
  subtitle: string;
  /** Seeded into the composer when tapped. */
  starter: string;
};

export const AI_ACTION_CARDS: readonly AiActionCard[] = [
  {
    id: 'build-set',
    title: 'Build a set',
    subtitle: 'Draft from your library, then Apply',
    starter: 'Build a 10-song set from my library. Prefer variety and good flow.',
  },
  {
    id: 'fix-chart',
    title: 'Clean up',
    subtitle: 'Structure ChordPro without inventing lyrics',
    starter: 'Clean this chart without rewriting my lyrics. Fix directives and section labels.',
  },
  {
    id: 'clean-import',
    title: 'From text',
    subtitle: 'Turn pasted lyrics into ChordPro',
    starter: 'Turn this pasted text into ChordPro. Preserve the lyrics. Ask me to paste if missing.',
  },
  {
    id: 'ask-library',
    title: 'What do I have?',
    subtitle: 'Grounded answers with library ids',
    starter: 'What do I have that would work as an acoustic opener? Cite song ids from the catalog.',
  },
] as const;

export type LibraryContextStub = {
  songCount: number;
  setlistCount: number;
  sampleTitles: string[];
  songs?: LibrarySongRef[];
  retrieved?: LibrarySongRef[];
  chartConsent?: { songId: string; title: string; chordpro: string };
  liveActive?: boolean;
};

function catalogLines(songs: LibrarySongRef[] | undefined, limit: number): string {
  if (!songs?.length) return '(no matching songs in scope)';
  return songs
    .slice(0, limit)
    .map((song) => {
      const duration = song.durationSeconds ? `${song.durationSeconds}s` : 'duration unknown';
      const fav = song.tags?.toLowerCase().includes('favorite') ? ' fav' : '';
      return `- ${song.id} :: ${song.title}${song.artist ? ` — ${song.artist}` : ''} [${duration}${fav}]`;
    })
    .join('\n');
}

export function buildSystemPrompt(ctx: LibraryContextStub): string {
  const catalog = ctx.retrieved?.length ? ctx.retrieved : ctx.songs;
  return [
    'You are Setlist Ultra AI — a preparation assistant for setlists and ChordPro charts.',
    'Use only catalog ids below. Never invent song ids, tempo, key, or duration.',
    'Label assumptions. Unknown metadata stays unknown. Do not claim you saved the library.',
    'Do not invent private API keys or ask the user to paste secrets into chat.',
    ctx.liveActive ? 'Live/stage mode is active: propose only; the app will refuse Apply until Live is left.' : '',
    `Library size: ${ctx.songCount} songs, ${ctx.setlistCount} setlists.`,
    'Retrieved catalog (id :: title — artist):',
    catalogLines(catalog, 40),
    ctx.chartConsent
      ? `User consented to send this chart body for cleanup (song ${ctx.chartConsent.songId} ${ctx.chartConsent.title}):\n${ctx.chartConsent.chordpro.slice(0, 8000)}`
      : 'Chart bodies are not included unless the musician opened Clean up on a song.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTaskSystemPrompt(taskType: AiActionId, ctx: LibraryContextStub): string {
  const schema =
    taskType === 'build-set'
      ? `Return ONLY JSON: {"type":"set-proposal","title":string,"songIds":string[],"uncertain":boolean,"notes":string}. songIds must be ids from the catalog. notes must list assumptions.`
      : taskType === 'ask-library'
        ? `Return ONLY JSON: {"type":"library-answer","songIds":string[],"uncertain":boolean,"notes":string}. Cite catalog ids. Do not propose writes.`
        : `Return ONLY JSON: {"type":"chart-patch","songId":string|null,"chordpro":string,"uncertain":boolean,"notes":string}. Preserve lyrics. Do not transpose by arithmetic — leave key as supplied. songId must be a catalog id or null.`;

  return [
    buildSystemPrompt(ctx),
    `Task: ${taskType}. promptVersion=${AI_PROMPT_VERSION} schemaVersion=${AI_SCHEMA_VERSION}.`,
    'This is a proposal. The app validates ids and the musician must Approve before anything is saved.',
    'Flag uncertain=true rather than inventing missing data. Never write SQL.',
    schema,
  ].join('\n');
}

export function starterMessages(starter: string, ctx: LibraryContextStub): ChatMessage[] {
  const system = buildSystemPrompt(ctx);
  if (!starter.trim()) {
    return [{ role: 'system', content: system }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: starter.trim() },
  ];
}

export function taskMessages(taskType: AiActionId, userText: string, ctx: LibraryContextStub): ChatMessage[] {
  return [
    { role: 'system', content: buildTaskSystemPrompt(taskType, ctx) },
    { role: 'user', content: userText.trim() },
  ];
}
