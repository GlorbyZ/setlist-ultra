import type { ChatMessage } from './types';

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
};

export function buildSystemPrompt(ctx: LibraryContextStub): string {
  const titles =
    ctx.sampleTitles.length > 0
      ? ctx.sampleTitles.slice(0, 40).map((t) => `- ${t}`).join('\n')
      : '(no song titles loaded yet)';

  return [
    'You are Setlist Ultra AI — a concise assistant for musicians building setlists and ChordPro charts.',
    'Prefer practical, stage-ready advice. Use ChordPro when suggesting chart edits.',
    'Do not invent private API keys or ask the user to paste secrets into chat.',
    `Library context (stub): ${ctx.songCount} songs, ${ctx.setlistCount} setlists.`,
    'Sample song titles from this device library:',
    titles,
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
