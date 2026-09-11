import type { ChatMessage } from './types';
import { AI_SCHEMA_VERSION, type LibrarySongRef } from './validate';

export const AI_PROMPT_VERSION = 'ai-tasks.v2';

export type AiActionId = 'build-set' | 'fix-chart' | 'clean-import' | 'ask-library';

export type AiActionCard = {
  id: AiActionId;
  title: string;
  subtitle: string;
  action: string;
  icon: 'list-outline' | 'construct-outline' | 'document-text-outline' | 'search-outline';
  /** Internal model seed. Never shown as a user chat bubble. */
  starter: string;
};

export const AI_ACTION_CARDS: readonly AiActionCard[] = [
  {
    id: 'build-set',
    title: 'Build a set',
    subtitle: 'Choose songs that fit your gig.',
    action: 'Set up',
    icon: 'list-outline',
    starter: 'Build a set from my library. Prefer variety and good flow.',
  },
  {
    id: 'fix-chart',
    title: 'Clean up a chart',
    subtitle: 'Fix formatting. Keep your lyrics.',
    action: 'Set up',
    icon: 'construct-outline',
    starter: 'Clean this chart without rewriting my lyrics. Fix directives and section labels.',
  },
  {
    id: 'clean-import',
    title: 'From text',
    subtitle: 'Turn your text into a song draft.',
    action: 'Set up',
    icon: 'document-text-outline',
    starter: 'Turn this pasted text into ChordPro. Preserve the lyrics.',
  },
  {
    id: 'ask-library',
    title: 'Explore your library',
    subtitle: 'Find songs and useful combinations.',
    action: 'Set up',
    icon: 'search-outline',
    starter: 'Find songs in my library that match this request. Cite catalog titles, not invented facts.',
  },
] as const;

export type AssistTaskFields = {
  setName?: string;
  songCount?: string;
  source?: 'library' | 'favorites';
  occasion?: string;
  leaveAlone?: string;
  paste?: string;
  title?: string;
  artist?: string;
  hasChords?: boolean;
  query?: string;
  refine?: string;
};

export function primaryTaskAction(task: AiActionId): string {
  switch (task) {
    case 'build-set':
      return 'Create draft';
    case 'fix-chart':
      return 'Analyze chart';
    case 'clean-import':
      return 'Create preview';
    case 'ask-library':
      return 'Search library';
  }
}

/** Model-facing prompt built from the workspace form. Not a visible user bubble. */
export function composeTaskUserText(task: AiActionId, fields: AssistTaskFields): string {
  const refine = fields.refine?.trim();
  switch (task) {
    case 'build-set':
      return [
        `Build a set named "${fields.setName?.trim() || 'Untitled set'}".`,
        `About ${fields.songCount?.trim() || '8'} songs.`,
        fields.source === 'favorites' ? 'Prefer songs tagged favorite when they fit.' : 'Use the whole library.',
        fields.occasion?.trim() ? `Occasion or energy: ${fields.occasion.trim()}` : '',
        refine ? `Additional direction: ${refine}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'fix-chart':
      return [
        'Clean this chart. Preserve lyric wording. Fix malformed directives, section labels, and spacing.',
        fields.leaveAlone?.trim() ? `Leave this alone: ${fields.leaveAlone.trim()}` : '',
        refine ? `Additional direction: ${refine}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'clean-import':
      return [
        'Turn this text into ChordPro. Preserve the lyrics. Do not invent missing verses.',
        fields.title?.trim() ? `Title: ${fields.title.trim()}` : '',
        fields.artist?.trim() ? `Artist: ${fields.artist.trim()}` : '',
        fields.hasChords ? 'The text already contains chords.' : 'Chords may be missing; do not invent a verified progression.',
        fields.paste?.trim() || '',
        refine ? `Additional direction: ${refine}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'ask-library':
      return [fields.query?.trim() || 'What do I have that would work as an acoustic opener?', refine ? `Additional direction: ${refine}` : '']
        .filter(Boolean)
        .join('\n');
  }
}

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
