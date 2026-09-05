import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Platform } from 'react-native';

import { Text } from '@/components/Themed';
import { actionFromKey, type PedalAction } from '@/src/lib/pedals';
import { colors } from '@/src/theme';

type Props = {
  title: string;
  subtitle?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onTranspose?: (delta: number) => void;
  onCapo?: (delta: number) => void;
  onToggleLyrics?: () => void;
  lyricsOnly?: boolean;
  onToggleScroll?: () => void;
  scrolling?: boolean;
  onEdit?: () => void;
  extra?: string;
  onPedal?: (action: PedalAction) => void;
};

export function LiveChrome({
  title,
  subtitle,
  onPrev,
  onNext,
  onTranspose,
  onCapo,
  onToggleLyrics,
  lyricsOnly,
  onToggleScroll,
  scrolling,
  onEdit,
  extra,
  onPedal,
}: Props) {
  return (
    <View>
      {Platform.OS !== 'web' ? (
        <TextInput
          style={styles.hidden}
          autoFocus
          showSoftInputOnFocus={false}
          caretHidden
          onKeyPress={(event) => {
            const action = actionFromKey(event.nativeEvent.key);
            if (action) onPedal?.(action);
          }}
        />
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
        {extra ? <Text style={styles.meta}>{extra}</Text> : null}
      </View>
      <View style={styles.controls}>
        {onPrev ? (
          <Pressable style={styles.chip} onPress={onPrev}>
            <Text style={styles.chipText}>Prev</Text>
          </Pressable>
        ) : null}
        {onNext ? (
          <Pressable style={styles.chip} onPress={onNext}>
            <Text style={styles.chipText}>Next</Text>
          </Pressable>
        ) : null}
        {onTranspose ? (
          <>
            <Pressable style={styles.chip} onPress={() => onTranspose(-1)}>
              <Text style={styles.chipText}>-1</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => onTranspose(1)}>
              <Text style={styles.chipText}>+1</Text>
            </Pressable>
          </>
        ) : null}
        {onCapo ? (
          <>
            <Pressable style={styles.chip} onPress={() => onCapo(-1)}>
              <Text style={styles.chipText}>Capo -</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => onCapo(1)}>
              <Text style={styles.chipText}>Capo +</Text>
            </Pressable>
          </>
        ) : null}
        {onToggleLyrics ? (
          <Pressable style={styles.chip} onPress={onToggleLyrics}>
            <Text style={styles.chipText}>{lyricsOnly ? 'Chords' : 'Lyrics'}</Text>
          </Pressable>
        ) : null}
        {onToggleScroll ? (
          <Pressable style={styles.chip} onPress={onToggleScroll}>
            <Text style={styles.chipText}>{scrolling ? 'Stop' : 'Scroll'}</Text>
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable style={styles.chip} onPress={onEdit}>
            <Text style={styles.chipText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  meta: { color: colors.muted, marginTop: 4 },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontWeight: '600' },
});
