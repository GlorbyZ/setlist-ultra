import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

/** Non-space probe — Android often reports width 0 for space-only Text. */
const WIDTH_PROBE = 'MMMMMMMMMM';
const WIDTH_PROBE_LEN = WIDTH_PROBE.length;

/**
 * Songbook Pro–style chord layout:
 * - Same fontSize / weight / family on chord + lyric (no size-1 / bold chords)
 * - ChordSlot.at is a logical lyric-character anchor
 * - Chord Text is absolute-positioned at at * measuredMonoCharWidth
 *
 * Uses a monospace char-width probe instead of per-prefix onLayout. Prefix
 * measurement was returning 0 on Android (absolute + opacity 0, and space-only
 * slices), which left-stacked every chord at x=0.
 *
 * While the probe is pending (or if it fails), fall back to a mono space-column
 * chord row so Live never paints a left-stacked absolute blob.
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
      ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : null),
    }),
    [size, theme.type.chart.fontWeight],
  );

  const sorted = useMemo(() => [...slots].sort((a, b) => a.at - b.at), [slots]);
  const isChordOnly = !lyric.trim() && sorted.length > 0;

  const [charWidth, setCharWidth] = useState(0);

  useEffect(() => {
    setCharWidth(0);
  }, [size, theme.type.chart.fontWeight]);

  const probe = (
    <View style={styles.probeBox} collapsable={false}>
      <Text
        style={chartFont}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setCharWidth(w / WIDTH_PROBE_LEN);
        }}>
        {WIDTH_PROBE}
      </Text>
    </View>
  );

  if (isChordOnly) {
    const chordRow = buildMonoChordRow(sorted, transpose, capo);
    return (
      <View style={styles.container}>
        <Text style={[chartFont, { color: theme.accent, lineHeight: chordLineHeight }]}>{chordRow || ' '}</Text>
        <Text style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>{' '}</Text>
      </View>
    );
  }

  if (charWidth <= 0) {
    const chordRow = buildMonoChordRow(sorted, transpose, capo);
    return (
      <View style={styles.container}>
        {probe}
        <Text style={[chartFont, { color: theme.accent, lineHeight: chordLineHeight }]}>{chordRow || ' '}</Text>
        <Text style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>{lyric || ' '}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {probe}
      <View style={[styles.chordRow, { height: chordLineHeight }]}>
        {sorted.map((slot, index) => {
          const at = Math.max(0, slot.at);
          const left = at * charWidth;
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
  probeBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
});
