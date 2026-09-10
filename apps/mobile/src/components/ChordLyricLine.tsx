import { useEffect, useMemo, useState } from 'react';
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

/**
 * Songbook Pro–style chord layout:
 * - Same fontSize / weight / family on chord + lyric (no size-1 / bold chords)
 * - ChordSlot.at is a logical lyric-character anchor
 * - Chord Text is absolute-positioned at measured width of lyric.slice(0, at)
 */
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
  const chartFont = useMemo(
    () => ({
      fontSize: size,
      fontFamily: 'SpaceMono' as const,
      fontWeight: theme.type.chart.fontWeight,
    }),
    [size, theme.type.chart.fontWeight],
  );

  const sorted = useMemo(() => [...slots].sort((a, b) => a.at - b.at), [slots]);
  const anchors = useMemo(
    () => [...new Set(sorted.map((slot) => Math.max(0, slot.at)))].sort((a, b) => a - b),
    [sorted],
  );

  const isChordOnly = !lyric.trim() && sorted.length > 0;
  const [prefixWidths, setPrefixWidths] = useState<Record<number, number>>(() =>
    (anchors.includes(0) ? { 0: 0 } : {}) as Record<number, number>,
  );

  useEffect(() => {
    setPrefixWidths((anchors.includes(0) ? { 0: 0 } : {}) as Record<number, number>);
  }, [lyric, size, theme.type.chart.fontWeight, anchors]);

  if (isChordOnly) {
    // Chord-only lines: mono space row is still useful (no lyric to measure against).
    const chordRow = buildMonoChordRow(sorted, transpose, capo);
    return (
      <View style={styles.container}>
        <Text style={[chartFont, { color: theme.accent, lineHeight: chordLineHeight }]}>{chordRow || ' '}</Text>
        <Text style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>{' '}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {anchors.map((at) => (
        <Text
          key={`measure-${at}`}
          style={[chartFont, styles.measure]}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            setPrefixWidths((prev) => (prev[at] === width ? prev : { ...prev, [at]: width }));
          }}>
          {lyric.slice(0, at)}
        </Text>
      ))}

      <View style={[styles.chordRow, { height: chordLineHeight }]}>
        {sorted.map((slot, index) => {
          const at = Math.max(0, slot.at);
          const left = prefixWidths[at] ?? 0;
          return (
            <Text
              key={`${slot.at}-${slot.chord}-${index}`}
              style={[
                chartFont,
                styles.chord,
                { left, color: theme.accent, lineHeight: chordLineHeight },
              ]}>
              {displayChord(slot.chord, capo, transpose)}
            </Text>
          );
        })}
      </View>

      <Text style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>{lyric || ' '}</Text>
    </View>
  );
}

function buildMonoChordRow(slots: ChordSlot[], transpose: number, capo: number): string {
  const chars: string[] = [];
  let cursor = 0;
  for (const slot of slots) {
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
  chordRow: { position: 'relative', width: '100%' },
  chord: { position: 'absolute', top: 0 },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: -1,
  },
});
