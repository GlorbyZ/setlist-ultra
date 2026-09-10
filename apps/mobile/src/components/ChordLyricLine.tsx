import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text as RNText, View } from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
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
  chordColor?: string;
  chordScale?: number;
};

/**
 * Songbook Pro–style chord layout with Verdana:
 * - ChordSlot.at is a lyric-character anchor
 * - X comes from onTextLayout of the prefix (NBSP so Android keeps spaces)
 * - Chords sit in absolutely positioned Views — Android ignores `left` on Text
 */
export function ChordLyricLine({
  lyric,
  slots = [],
  transpose = 0,
  capo = 0,
  fontSize,
  chordColor,
  chordScale = 1,
}: Props) {
  const { theme } = useTheme();
  const size = fontSize ?? theme.type.chart.fontSize;
  const lyricLineHeight = Math.round(size * (theme.type.chart.lineHeight / theme.type.chart.fontSize));
  const chordSize = Math.round(size * chordScale);
  const chordLineHeight = Math.round(lyricLineHeight * 0.78 * chordScale);
  const ink = chordColor ?? theme.accent;
  const chartFont = useMemo(
    () => ({
      fontSize: size,
      fontFamily: 'Verdana' as const,
      fontWeight: '400' as const,
      ...(Platform.OS === 'android' ? { includeFontPadding: false as const } : null),
    }),
    [size],
  );

  const sorted = useMemo(() => [...slots].sort((a, b) => a.at - b.at), [slots]);
  const anchors = useMemo(
    () => [...new Set(sorted.map((slot) => Math.max(0, slot.at)))].sort((a, b) => a - b),
    [sorted],
  );
  const isChordOnly = !lyric.trim() && sorted.length > 0;

  const [prefixWidths, setPrefixWidths] = useState<Record<number, number>>({});

  if (isChordOnly) {
    const chordRow = buildApproxChordRow(sorted, transpose, capo);
    return (
      <View style={styles.container}>
        <RNText
          allowFontScaling={false}
          style={[chartFont, { color: ink, lineHeight: chordLineHeight, fontSize: chordSize }]}>
          {chordRow || ' '}
        </RNText>
        <RNText allowFontScaling={false} style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>
          {' '}
        </RNText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.measureBox} pointerEvents="none" collapsable={false}>
        {anchors.map((at) => (
          <RNText
            key={`m-${at}-${size}-${lyric.length}`}
            allowFontScaling={false}
            numberOfLines={1}
            style={[chartFont, styles.measureText]}
            onTextLayout={(e) => onPrefixLayout(e, at, setPrefixWidths)}>
            {prefixForMeasure(lyric, at)}
          </RNText>
        ))}
      </View>

      <View style={[styles.chordRow, { height: chordLineHeight }]}>
        {sorted.map((slot, index) => {
          const at = Math.max(0, slot.at);
          const left = prefixWidths[at] ?? 0;
          return (
            <View
              key={`${slot.at}-${slot.chord}-${index}`}
              pointerEvents="none"
              style={[styles.chordSlot, { left, height: chordLineHeight }]}>
              <RNText
                allowFontScaling={false}
                numberOfLines={1}
                style={[chartFont, { color: ink, lineHeight: chordLineHeight, fontSize: chordSize }]}>
                {displayChord(slot.chord, capo, transpose)}
              </RNText>
            </View>
          );
        })}
      </View>

      <Text allowFontScaling={false} style={[chartFont, { color: theme.text, lineHeight: lyricLineHeight }]}>
        {lyric || ' '}
      </Text>
    </View>
  );
}

function prefixForMeasure(lyric: string, at: number): string {
  const prefix = lyric.slice(0, Math.max(0, at)).replace(/ /g, '\u00A0');
  return prefix.length ? prefix : '\u200B';
}

function onPrefixLayout(
  e: NativeSyntheticEvent<TextLayoutEventData>,
  at: number,
  setPrefixWidths: (update: (prev: Record<number, number>) => Record<number, number>) => void,
) {
  const w = e.nativeEvent.lines?.[0]?.width ?? 0;
  if (at === 0) {
    setPrefixWidths((prev) => (prev[0] === 0 ? prev : { ...prev, [0]: 0 }));
    return;
  }
  if (w <= 0) return;
  setPrefixWidths((prev) => (prev[at] === w ? prev : { ...prev, [at]: w }));
}

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
  chordRow: { position: 'relative', width: '100%', overflow: 'visible' },
  chordSlot: { position: 'absolute', top: 0 },
  measureBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 8000,
    opacity: 0,
  },
  measureText: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
