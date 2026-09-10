import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAPO_OPTIONS, KEY_OPTIONS } from '@setlist-ultra/core';

import { Text } from '@/components/Themed';
import { ActionSheet } from '@/src/components/BrandDialog';
import { actionFromKey, type PedalAction } from '@/src/lib/pedals';
import { MOTION_FAST, MOTION_MED, PressableScale } from '@/src/motion';
import { BRAND_GRADIENT, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  /** Bumps idle chrome when the active song changes. */
  chromeKey?: string;
  children?: ReactNode;
  onCapo?: (delta: number) => void;
  onCapoPick?: (capo: number) => void;
  capo?: number;
  onEdit?: () => void;
  onPedal?: (action: PedalAction) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onTranspose?: (delta: number) => void;
  onKeyPick?: (keyName: string) => void;
  soundingKey?: string | null;
  onToggleLyrics?: () => void;
  lyricsOnly?: boolean;
  onToggleScroll?: () => void;
  scrolling?: boolean;
  onZoom?: (delta: number) => void;
  padDock?: boolean;
  tempo?: number | null;
  /** Opens Songbook Pro–style setlist quick access (Live + active set only). */
  onOpenSetlist?: () => void;
};

const IDLE_MS = 4200;

export function LiveChrome({
  chromeKey,
  children,
  onCapo,
  onCapoPick,
  capo = 0,
  onEdit,
  onPedal,
  onPrev,
  onNext,
  onTranspose,
  onKeyPick,
  soundingKey,
  onToggleLyrics,
  lyricsOnly,
  onToggleScroll,
  scrolling,
  onZoom,
  tempo,
  onOpenSetlist,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [capoPickerOpen, setCapoPickerOpen] = useState(false);
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
  }, [bump, chromeKey]);

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
  const keyLabel = soundingKey?.trim() || 'Key';
  const capoLabel = 'Capo ' + capo;

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

      <View style={styles.stage}>{children}</View>

      {onOpenSetlist ? (
        <View
          pointerEvents="box-none"
          style={[styles.setlistFabWrap, { paddingTop: Math.max(insets.top, 8) }]}>
          <PressableScale
            style={styles.setlistFab}
            scaleTo={0.92}
            onPress={() => {
              bump();
              onOpenSetlist();
            }}
            accessibilityLabel="Open setlist">
            <Text style={styles.setlistFabIcon}>☰</Text>
          </PressableScale>
        </View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingBottom: bottomPad }, overlayStyle]}>
        <Pressable unstable_pressDelay={0} onPress={bump} style={styles.overlayHit} accessibilityLabel="Show live controls">
          {open ? (
            <View style={styles.toolsCard}>
              <View style={styles.tools}>
                {onPrev ? (
                  <PressableScale
                    style={styles.tool}
                    scaleTo={0.94}
                    onPress={() => {
                      bump();
                      onPrev();
                    }}>
                    <Text style={styles.toolText}>Prev</Text>
                  </PressableScale>
                ) : null}
                {onNext ? (
                  <PressableScale
                    style={styles.tool}
                    scaleTo={0.94}
                    onPress={() => {
                      bump();
                      onNext();
                    }}>
                    <Text style={styles.toolText}>Next</Text>
                  </PressableScale>
                ) : null}
                {onZoom ? (
                  <>
                    <PressableScale
                      style={styles.tool}
                      scaleTo={0.94}
                      onPress={() => {
                        bump();
                        onZoom(-1);
                      }}>
                      <Text style={styles.toolText}>Zoom −</Text>
                    </PressableScale>
                    <PressableScale
                      style={styles.tool}
                      scaleTo={0.94}
                      onPress={() => {
                        bump();
                        onZoom(1);
                      }}>
                      <Text style={styles.toolText}>Zoom +</Text>
                    </PressableScale>
                  </>
                ) : null}
                {onToggleScroll ? (
                  <PressableScale
                    style={styles.tool}
                    scaleTo={0.94}
                    onPress={() => {
                      bump();
                      onToggleScroll();
                    }}>
                    <Text style={styles.toolText}>{scrolling ? 'Stop' : 'Scroll'}</Text>
                  </PressableScale>
                ) : null}
                {tempo ? (
                  <View style={styles.tool}>
                    <Text style={styles.toolText}>Metro {tempo}</Text>
                  </View>
                ) : null}
                {onCapo || onCapoPick ? (
                  <>
                    {onCapoPick ? (
                      <PressableScale
                        style={styles.tool}
                        scaleTo={0.94}
                        onPress={() => {
                          bump();
                          setCapoPickerOpen(true);
                        }}>
                        <Text style={styles.toolText}>{capoLabel}</Text>
                      </PressableScale>
                    ) : null}
                    {onCapo ? (
                      <>
                        <PressableScale
                          style={styles.tool}
                          scaleTo={0.94}
                          onPress={() => {
                            bump();
                            onCapo(-1);
                          }}>
                          <Text style={styles.toolText}>Capo −</Text>
                        </PressableScale>
                        <PressableScale
                          style={styles.tool}
                          scaleTo={0.94}
                          onPress={() => {
                            bump();
                            onCapo(1);
                          }}>
                          <Text style={styles.toolText}>Capo +</Text>
                        </PressableScale>
                      </>
                    ) : null}
                  </>
                ) : null}
                {onTranspose || onKeyPick ? (
                  <>
                    {onKeyPick ? (
                      <PressableScale
                        style={styles.tool}
                        scaleTo={0.94}
                        onPress={() => {
                          bump();
                          setKeyPickerOpen(true);
                        }}>
                        <Text style={styles.toolText}>{'Key ' + keyLabel}</Text>
                      </PressableScale>
                    ) : null}
                    {onTranspose ? (
                      <>
                        <PressableScale
                          style={styles.tool}
                          scaleTo={0.94}
                          onPress={() => {
                            bump();
                            onTranspose(-1);
                          }}>
                          <Text style={styles.toolText}>Key −</Text>
                        </PressableScale>
                        <PressableScale
                          style={styles.tool}
                          scaleTo={0.94}
                          onPress={() => {
                            bump();
                            onTranspose(1);
                          }}>
                          <Text style={styles.toolText}>Key +</Text>
                        </PressableScale>
                      </>
                    ) : null}
                  </>
                ) : null}
                {onToggleLyrics ? (
                  <PressableScale
                    style={styles.tool}
                    scaleTo={0.94}
                    onPress={() => {
                      bump();
                      onToggleLyrics();
                    }}>
                    <Text style={styles.toolText}>{lyricsOnly ? 'Chords' : 'Lyrics'}</Text>
                  </PressableScale>
                ) : null}
                {onEdit ? (
                  <PressableScale
                    style={styles.tool}
                    scaleTo={0.94}
                    onPress={() => {
                      bump();
                      onEdit();
                    }}>
                    <Text style={styles.toolText}>Edit</Text>
                  </PressableScale>
                ) : null}
                <PressableScale style={styles.tool} scaleTo={0.94} onPress={() => setOpen(false)}>
                  <Text style={styles.toolText}>Done</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <PressableScale
              onPress={() => {
                setOpen(true);
                bump();
              }}
              style={styles.chipWrap}
              scaleTo={0.94}
              accessibilityLabel="Live tools">
              <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipBorder}>
                <View style={styles.chipInner}>
                  <Text style={styles.chipText}>Live ▾</Text>
                </View>
              </LinearGradient>
            </PressableScale>
          )}
        </Pressable>
      </Animated.View>

      <ActionSheet
        visible={keyPickerOpen}
        title="Concert key"
        onClose={() => setKeyPickerOpen(false)}
        options={KEY_OPTIONS.map((key) => ({
          label: key === keyLabel || key === soundingKey ? '\u2713 ' + key : key,
          onPress: () => onKeyPick?.(key),
        }))}
      />
      <ActionSheet
        visible={capoPickerOpen}
        title="Capo fret"
        onClose={() => setCapoPickerOpen(false)}
        options={CAPO_OPTIONS.map((n) => ({
          label: n === capo ? '\u2713 Capo ' + n : 'Capo ' + n,
          onPress: () => onCapoPick?.(n),
        }))}
      />
    </View>
  );
}

function makeStyles(t: AppTheme) {
  const overlayBg =
    t.id === 'ultra-light' ? 'rgba(255,255,255,0.92)' : t.id === 'stage' ? 'rgba(0,0,0,0.78)' : 'rgba(10,10,12,0.82)';
  return {
    shell: { flex: 1, backgroundColor: t.bg },
    hidden: { position: 'absolute' as const, width: 1, height: 1, opacity: 0 },
    stage: { flex: 1 },
    setlistFabWrap: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      zIndex: 5,
      paddingLeft: 8,
      paddingBottom: 4,
    },
    setlistFab: {
      width: 40,
      height: 40,
      padding: 0,
      borderRadius: t.radius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: overlayBg,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden' as const,
    },
    setlistFabIcon: {
      color: t.text,
      fontSize: 18,
      lineHeight: 18,
      fontWeight: '700' as const,
      textAlign: 'center' as const,
      includeFontPadding: false,
    },
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
