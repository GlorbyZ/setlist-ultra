import type { ProposalEnvelope } from './proposal';

/** Musician-facing copy. Never include internal ids, JSON, or escaped payloads. */
export function stripInternalPayload(text: string): string {
  const withoutFence = text.replace(/```(?:json)?[\s\S]*?```/gi, '').trim();
  const withoutJsonObject = withoutFence.replace(/\{[\s\S]*"type"\s*:\s*"(set-proposal|chart-patch|library-answer)"[\s\S]*\}\s*$/m, '').trim();
  return withoutJsonObject.replace(/\\n/g, '\n').replace(/\s+\n/g, '\n').trim();
}

export function songDisplayName(song: { title?: string; artist?: string }): string {
  const title = song.title?.trim() || 'Untitled';
  const artist = song.artist?.trim();
  return artist ? `${title} — ${artist}` : title;
}

export function reviewLines(envelope: ProposalEnvelope): string[] {
  if (envelope.body.kind === 'set') {
    return envelope.body.songs.map((song, index) => `${index + 1}. ${songDisplayName(song)}`);
  }
  if (envelope.body.kind === 'library') {
    return envelope.body.songs.map((song) => songDisplayName(song));
  }
  const preview = envelope.body.chordpro
    .split('\n')
    .filter((line) => !line.startsWith('{title') && line.trim())
    .slice(0, 8)
    .join('\n');
  return [preview || 'Chart draft ready.'];
}

export function reviewTitle(envelope: ProposalEnvelope): string {
  if (envelope.body.kind === 'set') return envelope.body.title || 'Draft set';
  if (envelope.body.kind === 'library') return 'Matching songs';
  return envelope.body.title ? `Chart: ${envelope.body.title}` : 'Chart draft';
}

export function primaryActionLabel(envelope: ProposalEnvelope): string {
  if (envelope.body.kind === 'set') return 'Save set';
  if (envelope.body.kind === 'library') return 'Open first song';
  return envelope.body.songId ? 'Apply selected changes' : 'Save song';
}
