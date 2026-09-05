import { type ReactNode, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { actionFromKey, type PedalAction } from '@/src/lib/pedals';
import { BRAND_GRADIENT, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  title: string;
  meta?: string;
  capo?: number;
  tempo?: number | null;
  children?: ReactNode;
  onCapo?: (delta: number) => void;
  onEdit?: () => void;
  onPedal?: (action: PedalAction) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onTranspose?: (delta: number) => void;
  onToggleLyrics?: () => void;
  lyricsOnly?: boolean;
  onToggleScroll?: () => void;
  scrolling?: boolean;
  onZoom?: (delta: number) => void;
  padDock?: boolean;
};

export function LiveChrome({
  title,
  meta,
  capo = 0,
  tempo,
  children,
  onCapo,
  onEdit,
  onPedal,
  onPrev,
  onNext,
  onTranspose,
  onToggleLyrics,
  lyricsOnly,
  onToggleScroll,
  scrolling,
  onZoom,
  padDock,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const dockPad = padDock ? Math.max(insets.bottom, 8) : 8;

  return (
    <View style={styles.shell}>
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
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {onCapo ? (
          <Pressable
            onPress={() => onCapo(1)}
            onLongPress={() => onCapo(-1)}
            delayLongPress={280}
            style={styles.capo}
            accessibilityLabel={`Capo ${capo}. Tap to raise, long-press to lower.`}>
            <Text style={styles.capoText}>Capo {capo}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stage}>{children}</View>

      <View style={[styles.dock, { paddingBottom: dockPad }]}>
        {open ? (
          <View style={styles.tools}>
            {onPrev ? (
              <Pressable style={styles.tool} onPress={onPrev}>
                <Text style={styles.toolText}>Prev</Text>
              </Pressable>
            ) : null}
            {onNext ? (
              <Pressable style={styles.tool} onPress={onNext}>
                <Text style={styles.toolText}>Next</Text>
              </Pressable>
            ) : null}
            {onZoom ? (
              <>
                <Pressable style={styles.tool} onPress={() => onZoom(-1)}>
                  <Text style={styles.toolText}>Zoom −</Text>
                </Pressable>
                <Pressable style={styles.tool} onPress={() => onZoom(1)}>
                  <Text style={styles.toolText}>Zoom +</Text>
                </Pressable>
              </>
            ) : null}
            {onToggleScroll ? (
              <Pressable style={styles.tool} onPress={onToggleScroll}>
                <Text style={styles.toolText}>{scrolling ? 'Stop' : 'Scroll'}</Text>
              </Pressable>
            ) : null}
            {tempo ? (
              <View style={styles.tool}>
                <Text style={styles.toolText}>Metro {tempo}</Text>
              </View>
            ) : null}
            {onCapo ? (
              <>
                <Pressable style={styles.tool} onPress={() => onCapo(-1)}>
                  <Text style={styles.toolText}>Capo −</Text>
                </Pressable>
                <Pressable style={styles.tool} onPress={() => onCapo(1)}>
                  <Text style={styles.toolText}>Capo +</Text>
                </Pressable>
              </>
            ) : null}
            {onTranspose ? (
              <>
                <Pressable style={styles.tool} onPress={() => onTranspose(-1)}>
                  <Text style={styles.toolText}>Key −</Text>
                </Pressable>
                <Pressable style={styles.tool} onPress={() => onTranspose(1)}>
                  <Text style={styles.toolText}>Key +</Text>
                </Pressable>
              </>
            ) : null}
            {onToggleLyrics ? (
              <Pressable style={styles.tool} onPress={onToggleLyrics}>
                <Text style={styles.toolText}>{lyricsOnly ? 'Chords' : 'Lyrics'}</Text>
              </Pressable>
            ) : null}
            {onEdit ? (
              <Pressable style={styles.tool} onPress={onEdit}>
                <Text style={styles.toolText}>Edit</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.tool} onPress={() => setOpen(false)}>
              <Text style={styles.toolText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setOpen(true)} style={styles.chipWrap} accessibilityLabel="Live tools">
            <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipBorder}>
              <View style={styles.chipInner}>
                <Text style={styles.chipText}>Live ▾</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    shell: { flex: 1, backgroundColor: t.bg },
    hidden: { position: 'absolute' as const, width: 1, height: 1, opacity: 0 },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.bg,
      gap: 8,
    },
    headerText: { flex: 1 },
    title: { color: t.text, fontSize: 18, fontWeight: '700' as const },
    meta: { color: t.muted, marginTop: 2, fontSize: 13 },
    capo: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    capoText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
    stage: { flex: 1 },
    dock: {
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.bg,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipWrap: { alignSelf: 'flex-end' as const },
    chipBorder: { borderRadius: t.radius.md, padding: 1 },
    chipInner: {
      backgroundColor: t.bg,
      borderRadius: t.radius.md - 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipText: { color: t.text, fontWeight: '700' as const },
    tools: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    tool: {
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    toolText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
  };
}
