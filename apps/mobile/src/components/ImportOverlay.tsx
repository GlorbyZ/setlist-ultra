import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandMark } from '@/src/components/BrandMark';
import type { ImportProgressEvent } from '@/src/lib/repository';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  visible: boolean;
  progress: ImportProgressEvent | null;
  error: string | null;
  finished: boolean;
  onCancel: () => void;
  onDone: () => void;
  onUndo?: () => void;
};

function phaseLabel(phase: ImportProgressEvent['phase']) {
  if (phase === 'sets') return 'Importing sets';
  if (phase === 'folders') return 'Importing folders';
  if (phase === 'done') return 'Import complete';
  return 'Importing songs';
}

export function ImportOverlay({ visible, progress, error, finished, onCancel, onDone, onUndo }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const total = progress?.totalSongs ?? 0;
  const done = progress?.processedSongs ?? 0;
  const ratio = total > 0 ? Math.min(1, done / total) : finished ? 1 : null;
  const running = !finished && !error;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (running) onCancel();
        else onDone();
      }}>
      <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <BrandMark height={44} />
        <Text style={styles.headline}>{error ? 'Import did not finish' : finished ? 'Import complete' : 'Importing library'}</Text>
        <Text style={styles.phase} accessibilityLiveRegion="polite">
          {error ? error : finished ? `${progress?.created ?? 0} added` : phaseLabel(progress?.phase ?? 'songs')}
        </Text>
        <Text style={styles.counts}>
          {running && total > 0
            ? `${done} of ${total} songs${progress?.currentTitle ? ` · ${progress.currentTitle}` : ''}`
            : running
              ? progress?.currentTitle || 'Starting…'
              : ''}
        </Text>
        <View style={styles.track} accessibilityRole="progressbar">
          {ratio == null && running ? (
            <View style={styles.indeterminate}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <LinearGradient
              colors={[...theme.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${Math.round((ratio ?? 0) * 100)}%` }]}
            />
          )}
        </View>
        {finished && !error ? (
          <View style={styles.summary}>
            <Text style={styles.summaryLine}>{progress?.created ?? 0} songs added</Text>
            <Text style={styles.summaryLine}>{progress?.reused ?? 0} already in library</Text>
            {progress?.variants ? (
              <Text style={styles.summaryLine}>{progress.variants} kept as separate arrangements</Text>
            ) : null}
            {progress?.totalSets ? <Text style={styles.summaryLine}>{progress.totalSets} sets</Text> : null}
            {progress?.totalFolders ? (
              <Text style={styles.summaryLine}>{progress.totalFolders} folders</Text>
            ) : null}
            {progress?.skipped ? <Text style={styles.summaryLine}>{progress.skipped} skipped</Text> : null}
            {progress?.failed ? <Text style={styles.summaryLine}>{progress.failed} failed</Text> : null}
          </View>
        ) : (
          <View style={styles.summary} />
        )}
        <View style={styles.footer}>
          {running ? <BrandButton label="Cancel" onPress={onCancel} /> : null}
          {finished || error ? <BrandButton label="Done" onPress={onDone} /> : null}
          {finished && onUndo ? (
            <Pressable onPress={onUndo} style={styles.undo}>
              <Text style={styles.undoLabel}>Undo this import</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return {
    screen: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 28, alignItems: 'center' as const },
    headline: {
      color: t.text,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800' as const,
      marginTop: 28,
      textAlign: 'center' as const,
    },
    phase: { color: t.accent, fontSize: 16, fontWeight: '700' as const, marginTop: 12, textAlign: 'center' as const },
    counts: { color: t.muted, fontSize: 15, marginTop: 6, marginBottom: 28, minHeight: 22 },
    track: {
      alignSelf: 'stretch' as const,
      height: 12,
      borderRadius: 6,
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden' as const,
      justifyContent: 'center' as const,
    },
    fill: { height: '100%' as const, borderRadius: 6 },
    indeterminate: { alignItems: 'center' as const },
    summary: { alignSelf: 'stretch' as const, marginTop: 28, flex: 1, gap: 8 },
    summaryLine: { color: t.text, fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
    footer: { alignSelf: 'stretch' as const, width: '100%' as const, gap: 10 },
    undo: { paddingVertical: 12, alignItems: 'center' as const },
    undoLabel: { color: t.accent, fontWeight: '700' as const, fontSize: 16 },
  };
}
