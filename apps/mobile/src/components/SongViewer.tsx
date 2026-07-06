import { ScrollView, StyleSheet, View } from 'react-native';
import type { SongDocument } from '@setlist-ultra/core';
import { transposeDocument } from '@setlist-ultra/core';
import { ChordLyricLine } from './ChordLyricLine';
import { Text } from '@/components/Themed';

type Props = {
  document: SongDocument;
  transpose?: number;
  capo?: number;
  hideChords?: boolean;
};

export function SongViewer({ document, transpose = 0, capo = 0, hideChords = false }: Props) {
  const displayDoc = transpose === 0 ? document : transposeDocument(document, transpose);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {displayDoc.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          {section.label ? <Text style={styles.sectionLabel}>{section.label}</Text> : null}
          {section.lines.map((line) => {
            if (line.kind === 'blank') {
              return <View key={line.id} style={styles.blank} />;
            }

            if (hideChords) {
              return (
                <Text key={line.id} style={styles.lyricOnly}>
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
    paddingBottom: 120,
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
    fontSize: 20,
    lineHeight: 30,
    marginBottom: 12,
  },
});
