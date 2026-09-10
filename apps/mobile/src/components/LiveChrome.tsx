import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { actionFromKey, type PedalAction } from '@/src/lib/pedals';
import { MOTION_FAST, MOTION_MED, PressableScale } from '@/src/motion';
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

const IDLE_MS = 4200;

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
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayOpacity = useSharedValue(1);

  const bump = useCallback(() => {
    overlayOpacity.value = withTiming(1, { duration: MOTION_FAST });
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (open) return;
    idleTimer.current = setTimeout(() => {
      overlayOpacity.value = withTiming(0.28, { duration: MOTION_MED * 2 });
    }, IDLE_MS);
  }, [open, overlayOpacity]);

  useEffect(() => {
    bump();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [bump, title]);

  useEffect(() => {
    if (open) {
      overlayOpacity.value = withTiming(1, { duration: MOTION_FAST });
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    bump();
  }, [open, bump, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const bottomPad = Math.max(insets.bottom, 10);

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
            onPress={() => {
              bump();
              onCapo(1);
            }}
            onLongPress={() => {
              bump();
              onCapo(-1);
            }}
            delayLongPress={280}
            style={styles.capo}
            accessibilityLabel={`Capo ${capo}. Tap to raise, long-press to lower.`}>
            <Text style={styles.capoText}>Capo {capo}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stage}>{children}</View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingBottom: bottomPad }, overlayStyle]}>
        <Pressable onPress={bump} style={styles.overlayHit} accessibilityLabel="Show live controls">
          {open ? (
            <View style={styles.toolsCard}>
              <View style={styles.tools}>
                {onPrev ? (
                  <Pressable
                    style={styles.tool}
                    onPress={() => {
                      bump();
                      onPrev();
                    }}>
                    <Text style={styles.toolText}>Prev</Text>
                  </Pressable>
                ) : null}
                {onNext ? (
                  <Pressable
                    style={styles.tool}
                    onPress={() => {
                      bump();
                      onNext();
                    }}>
                    <Text style={styles.toolText}>Next</Text>
                  </Pressable>
                ) : null}
                {onZoom ? (
                  <>
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onZoom(-1);
                      }}>
                      <Text style={styles.toolText}>Zoom −</Text>
                    </Pressable>
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onZoom(1);
                      }}>
                      <Text style={styles.toolText}>Zoom +</Text>
                    </Pressable>
                  </>
                ) : null}
                {onToggleScroll ? (
                  <Pressable
                    style={styles.tool}
                    onPress={() => {
                      bump();
                      onToggleScroll();
                    }}>
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
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onCapo(-1);
                      }}>
                      <Text style={styles.toolText}>Capo −</Text>
                    </Pressable>
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onCapo(1);
                      }}>
                      <Text style={styles.toolText}>Capo +</Text>
                    </Pressable>
                  </>
                ) : null}
                {onTranspose ? (
                  <>
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onTranspose(-1);
                      }}>
                      <Text style={styles.toolText}>Key −</Text>
                    </Pressable>
                    <Pressable
                      style={styles.tool}
                      onPress={() => {
                        bump();
                        onTranspose(1);
                      }}>
                      <Text style={styles.toolText}>Key +</Text>
                    </Pressable>
                  </>
                ) : null}
                {onToggleLyrics ? (
                  <Pressable
                    style={styles.tool}
                    onPress={() => {
                      bump();
                      onToggleLyrics();
                    }}>
                    <Text style={styles.toolText}>{lyricsOnly ? 'Chords' : 'Lyrics'}</Text>
                  </Pressable>
                ) : null}
                {onEdit ? (
                  <Pressable
                    style={styles.tool}
                    onPress={() => {
                      bump();
                      onEdit();
                    }}>
                    <Text style={styles.toolText}>Edit</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.tool} onPress={() => setOpen(false)}>
                  <Text style={styles.toolText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setOpen(true);
                bump();
              }}
              style={styles.chipWrap}
              accessibilityLabel="Live tools">
              <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipBorder}>
                <View style={styles.chipInner}>
                  <Text style={styles.chipText}>Live ▾</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  const overlayBg =
    t.id === 'ultra-light' ? 'rgba(255,255,255,0.92)' : t.id === 'stage' ? 'rgba(0,0,0,0.78)' : 'rgba(10,10,12,0.82)';
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
      zIndex: 2,
    },
    headerText: { flex: 1 },
    title: {
      color: t.text,
      fontSize: t.type.title.fontSize,
      lineHeight: t.type.title.lineHeight,
      fontWeight: t.type.title.fontWeight,
    },
    meta: {
      color: t.muted,
      marginTop: 2,
      fontSize: t.type.meta.fontSize,
      lineHeight: t.type.meta.lineHeight,
      fontWeight: t.type.meta.fontWeight,
    },
    capo: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    capoText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
    stage: { flex: 1 },
    overlay: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 12,
      paddingTop: 8,
      zIndex: 3,
    },
    overlayHit: { alignSelf: 'stretch' as const },
    toolsCard: {
      alignSelf: 'stretch' as const,
      backgroundColor: overlayBg,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    chipWrap: { alignSelf: 'flex-end' as const },
    chipBorder: { borderRadius: t.radius.md, padding: 1 },
    chipInner: {
      backgroundColor: overlayBg,
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
