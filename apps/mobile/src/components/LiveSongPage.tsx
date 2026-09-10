import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { useDisplayPrefs } from '@/src/display/DisplayPrefsProvider';
import { useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  title: string;
  meta?: string;
  /** When set, meta line is tappable for capo (current page only). */
  onCapo?: (delta: number) => void;
  capo?: number;
  children: ReactNode;
  /** Extra top inset when a fixed chrome control sits above (e.g. hamburger). */
  reserveTopLeft?: boolean;
};

/** Header + chart as one Live swipe page unit. */
export function LiveSongPage({ title, meta, onCapo, capo = 0, children, reserveTopLeft }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { prefs } = useDisplayPrefs();
  const insets = useSafeAreaInsets();
  const capoLabel = onCapo || capo > 0 ? `Capo ${capo}` : null;
  const metaLine = prefs.showMeta ? [meta, capoLabel].filter(Boolean).join(' · ') : '';
  const showHeader = prefs.showTitle || Boolean(metaLine);

  return (
    <View style={styles.page}>
      {showHeader ? (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={[styles.headerText, reserveTopLeft && styles.headerTextPad]}>
            {prefs.showTitle ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {metaLine ? (
              <Pressable
                unstable_pressDelay={0}
                disabled={!onCapo}
                onPress={() => onCapo?.(1)}
                onLongPress={() => onCapo?.(-1)}
                delayLongPress={280}
                accessibilityLabel={onCapo ? `Capo ${capo}. Tap to raise, long-press to lower.` : undefined}>
                <Text style={styles.meta} numberOfLines={1}>
                  {metaLine}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={{ height: Math.max(insets.top, reserveTopLeft ? 56 : 8) }} />
      )}
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    page: { flex: 1, backgroundColor: t.bg },
    header: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.bg,
    },
    headerText: { alignItems: 'center' as const, justifyContent: 'center' as const, maxWidth: '100%' as const },
    headerTextPad: { paddingHorizontal: 48 },
    title: {
      color: t.text,
      fontSize: t.type.title.fontSize,
      lineHeight: t.type.title.lineHeight,
      fontWeight: t.type.title.fontWeight,
      textAlign: 'center' as const,
    },
    meta: {
      color: t.muted,
      marginTop: 2,
      fontSize: t.type.meta.fontSize,
      lineHeight: t.type.meta.lineHeight,
      fontWeight: t.type.meta.fontWeight,
      textAlign: 'center' as const,
    },
    stage: { flex: 1 },
  };
}
