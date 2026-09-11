import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { SongDocument } from '@setlist-ultra/core';
import { chartJumpTargets, filterChartSections } from '@setlist-ultra/core';
import { ChordLyricLine } from './ChordLyricLine';
import { Text } from '@/components/Themed';
import { DEFAULT_AUTOSCROLL_SECONDS } from '@/src/lib/autoscroll';
import { useDisplayPrefs } from '@/src/display/DisplayPrefsProvider';
import { resolveChordColor } from '@/src/display/prefs';
import { useTheme } from '@/src/theme';

type Props = {
  document: SongDocument;
  transpose?: number;
  capo?: number;
  hideChords?: boolean;
  autoScrollSeconds?: number;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  onScrollBy?: (delta: number) => void;
  compact?: boolean;
  initialScrollY?: number;
  onScrollOffset?: (y: number) => void;
};

export type SongViewerHandle = {
  scrollToNextSection: () => void;
  scrollBy: (delta: number) => void;
};

export const SongViewer = forwardRef<SongViewerHandle, Props>(function SongViewer(
  {
    document,
    transpose = 0,
    capo = 0,
    hideChords = false,
    autoScrollSeconds,
    fontSize,
    onFontSizeChange,
    compact = false,
    initialScrollY = 0,
    onScrollOffset,
  },
  ref,
) {
  const { theme } = useTheme();
  const { prefs } = useDisplayPrefs();
  const chartSize = fontSize ?? prefs.chartFontSize;
  const chordColor = resolveChordColor(theme, prefs);
  const chordScale = prefs.highContrast ? Math.max(prefs.chordFontScale, 1.08) : prefs.chordFontScale;
  const scrollRef = useRef<ScrollView>(null);
  const fontSizeRef = useRef(chartSize);
  fontSizeRef.current = chartSize;
  const [contentH, setContentH] = useState(1);
  const [layoutH, setLayoutH] = useState(1);
  const scrollYRef = useRef(0);
  const restoredScroll = useRef(false);
  const sectionYRef = useRef<Record<string, number>>({});
  const lineRelYRef = useRef<Record<string, { sectionId: string; y: number }>>({});
  const jumpYRef = useRef<Record<string, number>>({});

  const targets = useMemo(
    () => chartJumpTargets(filterChartSections(document, prefs.hiddenSectionKinds)),
    [document, prefs.hiddenSectionKinds],
  );
  const visibleDocument = useMemo(
    () => filterChartSections(document, prefs.hiddenSectionKinds),
    [document, prefs.hiddenSectionKinds],
  );
  const targetIds = useMemo(() => new Set(targets.map((t) => t.id)), [targets]);

  const recomputeJumpY = () => {
    const next: Record<string, number> = {};
    for (const target of targets) {
      if (target.kind === 'section') {
        next[target.id] = sectionYRef.current[target.sectionId] ?? 0;
        continue;
      }
      const rel = lineRelYRef.current[target.id];
      next[target.id] = (sectionYRef.current[rel?.sectionId ?? target.sectionId] ?? 0) + (rel?.y ?? 0);
    }
    jumpYRef.current = next;
  };

  useImperativeHandle(ref, () => ({
    scrollToNextSection() {
      recomputeJumpY();
      const ordered = targets
        .map((target) => ({ ...target, y: jumpYRef.current[target.id] ?? 0 }))
        .sort((a, b) => a.y - b.y);
      if (!ordered.length) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      const y = scrollYRef.current;
      const next = ordered.find((target) => target.y > y + 36);
      const dest = next ?? ordered[0];
      scrollRef.current?.scrollTo({ y: Math.max(0, dest.y), animated: true });
    },
    scrollBy(delta: number) {
      const next = Math.max(0, scrollYRef.current + delta);
      scrollYRef.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: true });
      onScrollOffset?.(next);
    },
  }));

  useEffect(() => {
    restoredScroll.current = false;
  }, [document]);

  useEffect(() => {
    if (restoredScroll.current || !initialScrollY || contentH < 8) return;
    restoredScroll.current = true;
    scrollYRef.current = initialScrollY;
    scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
  }, [contentH, initialScrollY, document]);

  useEffect(() => {
    if (autoScrollSeconds == null) return;
    const seconds = autoScrollSeconds > 0 ? autoScrollSeconds : DEFAULT_AUTOSCROLL_SECONDS;
    const max = Math.max(0, contentH - layoutH);
    if (max <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / (seconds * 1000));
      scrollRef.current?.scrollTo({ y: max * t, animated: false });
      if (t >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [autoScrollSeconds, contentH, layoutH, document]);

  const applyPinch = (scale: number) => {
    if (!onFontSizeChange || !Number.isFinite(scale) || scale <= 0) return;
    onFontSizeChange(Math.round(Math.min(32, Math.max(14, fontSizeRef.current * scale))));
  };

  const pinch = Gesture.Pinch()
    .enabled(Boolean(onFontSizeChange))
    .onEnd((event) => {
      runOnJS(applyPinch)(event.scale);
    });

  return (
    <GestureDetector gesture={pinch}>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        scrollEnabled={!compact && (prefs.layoutMode !== 'auto' || contentH > layoutH + 8)}
        contentContainerStyle={[
          styles.container,
          {
            padding: prefs.chartPadding,
            paddingBottom: compact ? prefs.chartPadding : Math.max(96, prefs.chartPadding + 76),
          },
        ]}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollYRef.current = y;
          onScrollOffset?.(y);
        }}
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentH(h)}
        onLayout={(e) => setLayoutH(e.nativeEvent.layout.height)}>
        {visibleDocument.sections.map((section) => (
          <View
            key={section.id}
            style={styles.section}
            onLayout={(e) => {
              sectionYRef.current[section.id] = e.nativeEvent.layout.y;
              recomputeJumpY();
            }}>
            {section.label && prefs.showSectionHeaders ? (
              <Text style={[styles.sectionLabel, { color: theme.muted, fontSize: theme.type.meta.fontSize }]}>
                {section.label}
              </Text>
            ) : null}
            {section.lines.map((line) => {
              const jumpWrap = targetIds.has(line.id);
              const long = (line.lyric?.length ?? 0) > 42;
              const lineSize =
                (prefs.longLines === 'shrink' || (prefs.longLines === 'split' && !hideChords)) && long
                  ? Math.round(chartSize * 0.86)
                  : chartSize;
              const lineHeight = Math.round(lineSize * (theme.type.chart.lineHeight / theme.type.chart.fontSize));
              const body = (() => {
                if (line.kind === 'blank') {
                  return <View style={styles.blank} />;
                }
                if (hideChords) {
                  const parts =
                    prefs.longLines === 'split' ? splitLyric(line.lyric ?? '') : [line.lyric ?? ''];
                  return (
                    <View>
                      {parts.map((part, i) => (
                        <Text
                          key={`${line.id}-p${i}`}
                          allowFontScaling={false}
                          style={[
                            styles.lyricOnly,
                            {
                              fontSize: lineSize,
                              lineHeight,
                              color: theme.text,
                              fontWeight: theme.type.chart.fontWeight,
                            },
                          ]}>
                          {part}
                        </Text>
                      ))}
                    </View>
                  );
                }
                if (section.kind === 'tab') {
                  return (
                    <Text
                      allowFontScaling={false}
                      style={[styles.tabLine, { fontSize: lineSize - 2, lineHeight, color: theme.muted }]}>
                      {line.lyric ?? ''}
                    </Text>
                  );
                }
                return (
                  <ChordLyricLine
                    lyric={line.lyric ?? ''}
                    slots={line.slots}
                    transpose={transpose}
                    capo={capo}
                    fontSize={lineSize}
                    chordColor={chordColor}
                    chordScale={chordScale}
                  />
                );
              })();

              return (
                <View
                  key={line.id}
                  onLayout={
                    jumpWrap
                      ? (e) => {
                          lineRelYRef.current[line.id] = { sectionId: section.id, y: e.nativeEvent.layout.y };
                          recomputeJumpY();
                        }
                      : undefined
                  }>
                  {body}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </GestureDetector>
  );
});

function splitLyric(lyric: string) {
  if (lyric.length <= 42) return [lyric];
  const mid = Math.ceil(lyric.length / 2);
  const at = lyric.lastIndexOf(' ', mid);
  const cut = at > 12 ? at : 42;
  return [lyric.slice(0, cut).trimEnd(), lyric.slice(cut).trimStart()].filter(Boolean);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 96,
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontWeight: '600',
    opacity: 0.75,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blank: {
    height: 14,
  },
  lyricOnly: {
    fontFamily: 'Verdana',
    marginBottom: 14,
  },
  tabLine: {
    fontFamily: 'Verdana',
    marginBottom: 2,
  },
});
