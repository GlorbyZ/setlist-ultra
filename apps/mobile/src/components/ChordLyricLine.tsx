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
  fontSize,
}: Props) {
  const { theme } = useTheme();
  const size = fontSize ?? theme.type.chart.fontSize;
  const lyricLineHeight = Math.round(size * (theme.type.chart.lineHeight / theme.type.chart.fontSize));
  const chordLineHeight = Math.round(lyricLineHeight * 0.78);
  const chordRow = buildChordRow(lyric, slots, transpose, capo);

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.mono,
          { fontSize: size - 1, color: theme.accent, lineHeight: chordLineHeight, fontWeight: '600' },
        ]}>
        {chordRow || ' '}
      </Text>
      <Text
        style={[
          styles.mono,
          {
            fontSize: size,
            color: theme.text,
            lineHeight: lyricLineHeight,
            fontWeight: theme.type.chart.fontWeight,
          },
        ]}>
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
  container: { marginBottom: 14 },
  mono: { fontFamily: 'SpaceMono' },
});
