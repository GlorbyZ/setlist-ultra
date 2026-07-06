import { StyleSheet, View } from 'react-native';
import type { ChordSlot } from '@setlist-ultra/core';
import { displayChord } from '@setlist-ultra/core';
import { Text } from '@/components/Themed';

type Props = {
  lyric: string;
  slots?: ChordSlot[];
  transpose?: number;
  capo?: number;
  fontSize?: number;
};

export function ChordLyricLine({
  lyric,
  slots = [],
  transpose = 0,
  capo = 0,
  fontSize = 18,
}: Props) {
  const chordRow = buildChordRow(lyric, slots, transpose, capo, fontSize);

  return (
    <View style={styles.container}>
      <Text style={[styles.chordLine, { fontSize: fontSize - 2 }]}>{chordRow || ' '}</Text>
      <Text style={[styles.lyricLine, { fontSize }]}>{lyric || ' '}</Text>
    </View>
  );
}

function buildChordRow(
  lyric: string,
  slots: ChordSlot[],
  transpose: number,
  capo: number,
  fontSize: number,
): string {
  if (!slots.length) return '';

  const charWidth = fontSize * 0.55;
  const row: string[] = [];

  for (const slot of slots) {
    const chord = displayChord(slot.chord, capo, transpose);
    const index = Math.max(0, Math.round(slot.at * charWidth));
    while (row.length < index) row.push(' ');
    row.push(chord);
    row.push(' ');
  }

  return row.join('').trimEnd();
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  chordLine: {
    fontFamily: 'SpaceMono',
    color: '#f59e0b',
    minHeight: 22,
  },
  lyricLine: {
    lineHeight: 28,
  },
});
