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

/** Marker so space-only prefixes still get non-zero layout width on Android. */
const MEASURE_PAD = '汉';

/**
 * Songbook Pro–style chord layout with Verdana (proportional):
 * - Same fontSize / weight / family on chord + lyric
 * - ChordSlot.at is a logical lyric-character anchor
 * - Chord X = measured width(PAD + lyric.slice(0, at)) - width(PAD)
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
      fontFamily: 'Verdana' as const,
      fontWeight: theme.type.chart.fontWeight,
      ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : null),
    }),
    [size, theme.type.chart.fontWeight],
  );

  const sorted = useMemo(() => [...slots].sort((a, b) => a.at - b.at), [slots]);
  const anchors = useMemo(
    () => [...new Set(sorted.map((slot) => Math.max(0, slot.at)))].sort((a, b) => a - b),
    [sorted],
  );
  const anchorKey = anchors.join(',');
  const isChordOnly = !lyric.trim() && sorted.length > 0;

  const [padWidth, setPadWidth] = useState(0);
  /** Raw onLayout width of PAD + prefix (includes pad). */
  const [rawWidths, setRawWidths] = useState<Record<number, number>>({});

  useEffect(() => {
    setPadWidth(0);
    setRawWidths({});
  }, [lyric, size, theme.type.chart.fontWeight, anchorKey]);

  if (isChordOnly) {
    const chordRow = buildApproxChordRow(sorted, transpose, capo);
    return (
      <View style={styles.container}>
        <Text style={[chartFont, { color: theme.accent, lineHeight: chordLineHeight }]}>{chordRow || ' '}</Text>
        <Text style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>{' '}</Text>
      </View>
    );
  }

  const measured =
    padWidth > 0 && anchors.length > 0
      ? anchors.every((at) => rawWidths[at] != null)
      : anchors.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.measureBox} collapsable={false}>
        <Text
          style={chartFont}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setPadWidth((prev) => (prev === w ? prev : w));
          }}>
          {MEASURE_PAD}
        </Text>
        {anchors.map((at) => (
          <Text
            key={`m-${at}-${size}`}
            style={chartFont}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w <= 0) return;
              setRawWidths((prev) => (prev[at] === w ? prev : { ...prev, [at]: w }));
            }}>
            {MEASURE_PAD}
            {lyric.slice(0, at)}
          </Text>
        ))}
      </View>

      <View style={[styles.chordRow, { height: chordLineHeight }]}>
        {sorted.map((slot, index) => {
          const at = Math.max(0, slot.at);
          if (!measured) {
            // Only paint at=0 early; hide others to avoid left-stack blob.
            if (at > 0) return null;
          }
          const left = measured && padWidth > 0 ? Math.max(0, (rawWidths[at] ?? padWidth) - padWidth) : 0;
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

/** Chord-only fallback: space-padded approx (no lyric metrics). */
function buildApproxChordRow(slots: ChordSlot[], transpose: number, capo: number): string {
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
  measureBox: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 1,
  },
});
