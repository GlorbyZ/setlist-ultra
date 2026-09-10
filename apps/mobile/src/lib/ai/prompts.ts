import type { ChatMessage } from './types';
import { AI_SCHEMA_VERSION, type LibrarySongRef } from './validate';

export const AI_PROMPT_VERSION = 'ai-tasks.v1';

export type AiActionId = 'build-set' | 'fix-chart' | 'clean-import' | 'ask';

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
    subtitle: 'Suggest a set from your library',
    starter: 'Build a 10-song set from my library. Prefer variety and good flow.',
  },
  {
    id: 'fix-chart',
    title: 'Fix this chart',
    subtitle: 'ChordPro / formatting help',
    starter: 'Help me fix chart formatting issues (chords, sections, repeats).',
  },
  {
    id: 'clean-import',
    title: 'Clean import',
    subtitle: 'Tidy pasted lyrics / ChordPro',
    starter: 'Clean up this import into clean ChordPro. Ask me to paste the text.',
  },
  {
    id: 'ask',
    title: 'Ask…',
    subtitle: 'Freeform setlist help',
    starter: '',
  },
] as const;

export type LibraryContextStub = {
  songCount: number;
  setlistCount: number;
  sampleTitles: string[];
  songs?: LibrarySongRef[];
};

function catalogLines(ctx: LibraryContextStub, limit = 80): string {
  if (ctx.songs?.length) {
    return ctx.songs
      .slice(0, limit)
      .map((song) => `- ${song.id} :: ${song.title}${song.artist ? ` — ${song.artist}` : ''}`)
      .join('\n');
  }
  if (ctx.sampleTitles.length > 0) {
    return ctx.sampleTitles.slice(0, 40).map((t) => `- ${t}`).join('\n');
  }
  return '(no song titles loaded yet)';
}

export function buildSystemPrompt(ctx: LibraryContextStub): string {
  return [
    'You are Setlist Ultra AI — a concise assistant for musicians building setlists and ChordPro charts.',
    'Prefer practical, stage-ready advice. Use ChordPro when suggesting chart edits.',
    'Do not invent private API keys or ask the user to paste secrets into chat.',
    'Do not invent song IDs. Only use ids from the catalog below.',
    `Library: ${ctx.songCount} songs, ${ctx.setlistCount} setlists. Catalog is id :: title — artist (no chart bodies).`,
    catalogLines(ctx),
  ].join('\n');
}

export function buildTaskSystemPrompt(
  taskType: Exclude<AiActionId, 'ask'>,
  ctx: LibraryContextStub,
): string {
  const schema =
    taskType === 'build-set'
      ? `Return ONLY JSON: {"type":"set-proposal","title":string,"songIds":string[],"uncertain":boolean,"notes":string}. songIds must be ids from the catalog.`
      : `Return ONLY JSON: {"type":"chart-patch","songId":string|null,"chordpro":string,"uncertain":boolean,"notes":string}. chordpro must be valid ChordPro. songId must be a catalog id or null.`;

  return [
    buildSystemPrompt(ctx),
    `Task: ${taskType}. promptVersion=${AI_PROMPT_VERSION} schemaVersion=${AI_SCHEMA_VERSION}.`,
    'This is a proposal. The app will validate and the musician must approve before anything is saved.',
    'Flag uncertain=true rather than inventing missing data. Never write SQL or claim you saved the library.',
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

export function taskMessages(
  taskType: Exclude<AiActionId, 'ask'>,
  userText: string,
  ctx: LibraryContextStub,
): ChatMessage[] {
  return [
    { role: 'system', content: buildTaskSystemPrompt(taskType, ctx) },
    { role: 'user', content: userText.trim() },
  ];
}
