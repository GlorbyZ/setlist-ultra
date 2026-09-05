import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SongDocument } from '@setlist-ultra/core';
import { transposeDocument } from '@setlist-ultra/core';
import { ChordLyricLine } from './ChordLyricLine';
import { Text } from '@/components/Themed';
import { useTheme } from '@/src/theme';

type Props = {
  document: SongDocument;
  transpose?: number;
  capo?: number;
  hideChords?: boolean;
  autoScrollSeconds?: number;
  fontSize?: number;
  onScrollBy?: (delta: number) => void;
};

export function SongViewer({
  document,
  transpose = 0,
  capo = 0,
  hideChords = false,
  autoScrollSeconds,
  fontSize = 18,
}: Props) {
  const { theme } = useTheme();
  const displayDoc = transpose === 0 ? document : transposeDocument(document, transpose);
  const scrollRef = useRef<ScrollView>(null);
  const [contentH, setContentH] = useState(1);
  const [layoutH, setLayoutH] = useState(1);

  useEffect(() => {
    if (!autoScrollSeconds || autoScrollSeconds <= 0) return;
    const max = Math.max(0, contentH - layoutH);
    if (max <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / (autoScrollSeconds * 1000));
      scrollRef.current?.scrollTo({ y: max * t, animated: false });
      if (t >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [autoScrollSeconds, contentH, layoutH, document]);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      onContentSizeChange={(_, h) => setContentH(h)}
      onLayout={(e) => setLayoutH(e.nativeEvent.layout.height)}>
      {displayDoc.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          {section.label ? <Text style={styles.sectionLabel}>{section.label}</Text> : null}
          {section.lines.map((line) => {
            if (line.kind === 'blank') {
              return <View key={line.id} style={styles.blank} />;
            }
            if (hideChords) {
              return (
                <Text key={line.id} style={[styles.lyricOnly, { fontSize, lineHeight: fontSize * 1.5 }]}>
                  {line.lyric ?? ''}
                </Text>
              );
            }
            if (section.kind === 'tab') {
              return (
                <Text key={line.id} style={[styles.tabLine, { fontSize: fontSize - 2, color: theme.muted }]}>
                  {line.lyric ?? ''}
                </Text>
              );
            }
            return (
              <ChordLyricLine
                key={line.id}
                lyric={line.lyric ?? ''}
                slots={line.slots}
                transpose={transpose}
                capo={capo}
                fontSize={fontSize}
              />
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.7,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  blank: {
    height: 12,
  },
  lyricOnly: {
    marginBottom: 12,
  },
  tabLine: {
    fontFamily: 'SpaceMono',
    marginBottom: 2,
  },
});
