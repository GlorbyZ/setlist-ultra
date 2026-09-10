import { ActivityIndicator, Modal, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EMPTY_SYNC_PROGRESS,
  syncCountLabel,
  syncPhaseLabel,
  syncProgressRatio,
  syncSummaryLines,
  type SyncProgressEvent,
} from '@setlist-ultra/core';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandMark } from '@/src/components/BrandMark';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  visible: boolean;
  headline: string;
  progress: SyncProgressEvent | null;
  error: string | null;
  finished: boolean;
  onDone: () => void;
};

export function SyncOverlay({ visible, headline, progress, error, finished, onDone }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const current = progress ?? EMPTY_SYNC_PROGRESS;
  const ratio = syncProgressRatio(current.done, current.total);
  const running = !finished && !error;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {
      if (finished || error) onDone();
    }}>
      <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <BrandMark height={44} />
        <Text style={styles.headline}>{error ? 'Sync did not finish' : finished ? 'Library ready' : headline}</Text>
        <Text style={styles.phase} accessibilityLiveRegion="polite">
          {error ? error : finished ? syncCountLabel({ ...current, phase: 'done' }) : syncPhaseLabel(current.phase)}
        </Text>
        <Text style={styles.counts}>{error ? '' : running ? syncCountLabel(current) : ''}</Text>

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
              style={[styles.fill, { width: `${Math.round((ratio ?? (finished ? 1 : 0)) * 100)}%` }]}
            />
          )}
        </View>

        {finished && !error ? (
          <View style={styles.summary}>
            {syncSummaryLines(current).map((line) => (
              <Text key={line} style={styles.summaryLine}>
                {line}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.summary} />
        )}

        {error || finished ? (
          <View style={styles.footer}>
            <BrandButton label={error ? 'Close' : 'Done'} onPress={onDone} />
          </View>
        ) : (
          <View style={styles.footer} />
        )}
      </View>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return {
    screen: {
      flex: 1,
      backgroundColor: t.bg,
      paddingHorizontal: 28,
      alignItems: 'center' as const,
    },
    headline: {
      color: t.text,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800' as const,
      marginTop: 28,
      textAlign: 'center' as const,
    },
    phase: {
      color: t.accent,
      fontSize: 16,
      fontWeight: '700' as const,
      marginTop: 12,
      textAlign: 'center' as const,
    },
    counts: {
      color: t.muted,
      fontSize: 15,
      marginTop: 6,
      marginBottom: 28,
      minHeight: 22,
    },
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
    fill: {
      height: '100%' as const,
      borderRadius: 6,
    },
    indeterminate: {
      alignItems: 'center' as const,
    },
    summary: {
      alignSelf: 'stretch' as const,
      marginTop: 28,
      flex: 1,
      gap: 8,
    },
    summaryLine: {
      color: t.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600' as const,
    },
    footer: { alignSelf: 'stretch' as const, width: '100%' as const },
  };
}
