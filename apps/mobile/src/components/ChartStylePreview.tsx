import { View } from 'react-native';

import { Text } from '@/components/Themed';
import { SongViewer } from '@/src/components/SongViewer';
import { LOOK_PREVIEW_CHART } from '@/src/display/sampleChart';
import { useDisplayPrefs } from '@/src/display/DisplayPrefsProvider';
import { useThemedStyles, type AppTheme } from '@/src/theme';

export function ChartStylePreview() {
  const { prefs } = useDisplayPrefs();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.frame}>
      {prefs.showTitle || prefs.showMeta ? (
        <View style={styles.header}>
          {prefs.showTitle ? (
            <Text style={styles.title} numberOfLines={1}>
              Sample song
            </Text>
          ) : null}
          {prefs.showMeta ? (
            <Text style={styles.meta} numberOfLines={1}>
              Artist · G · Capo 2
            </Text>
          ) : null}
        </View>
      ) : null}
      <SongViewer
        document={LOOK_PREVIEW_CHART}
        fontSize={prefs.chartFontSize}
        hideChords={prefs.lyricsOnlyDefault}
        compact
      />
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    frame: {
      height: 200,
      overflow: 'hidden' as const,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bg,
      marginBottom: 16,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    title: {
      color: t.text,
      fontWeight: '700' as const,
      fontSize: 16,
      textAlign: 'center' as const,
    },
    meta: {
      color: t.muted,
      marginTop: 2,
      fontSize: 12,
      textAlign: 'center' as const,
    },
  };
}
