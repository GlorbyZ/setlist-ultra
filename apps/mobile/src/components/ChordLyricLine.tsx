import { StyleSheet, View } from 'react-native';
import type { ChordSlot } from '@setlist-ultra/core';
import { displayChord } from '@setlist-ultra/core';
import { Text } from '@/components/Themed';
import { useTheme } from '@/src/theme';

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
  const { theme } = useTheme();
  const chordRow = buildChordRow(lyric, slots, transpose, capo);

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.mono,
          { fontSize: fontSize - 1, color: theme.accent, lineHeight: fontSize + 4 },
        ]}>
        {chordRow || ' '}
      </Text>
      <Text style={[styles.mono, { fontSize, color: theme.text, lineHeight: fontSize + 8 }]}>
        {lyric || ' '}
      </Text>
    </View>
  );
}

function buildChordRow(
  _lyric: string,
  slots: ChordSlot[],
  transpose: number,
  capo: number,
): string {
  if (!slots.length) return '';

  const sorted = [...slots].sort((a, b) => a.at - b.at);
  const chars: string[] = [];
  let cursor = 0;

  for (const slot of sorted) {
    const chord = displayChord(slot.chord, capo, transpose);
    const at = Math.max(cursor, Math.max(0, slot.at));
    while (chars.length < at) chars.push(' ');
    for (const ch of chord) chars.push(ch);
    cursor = chars.length;
  }

  return chars.join('').trimEnd();
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  mono: { fontFamily: 'SpaceMono' },
});
