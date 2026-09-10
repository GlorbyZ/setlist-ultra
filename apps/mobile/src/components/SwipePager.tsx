import { type ReactNode, useLayoutEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_MED, SNAP_SPRING, useReduceMotion } from '@/src/motion';
import { useTheme } from '@/src/theme';

type Props = {
  children: ReactNode;
  /** Pre-rendered previous page (kept warm for instant swipe). */
  prevPage?: ReactNode;
  /** Pre-rendered next page (kept warm for instant swipe). */
  nextPage?: ReactNode;
  /** Song/page id — resets transform after index changes without flash. */
  pageKey?: string;
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
};

/**
 * Gallery swipe: three warm pages on a track.
 * On settle, React swaps prev/center/next then useLayoutEffect snaps tx→0
 * before paint. Never fades opacity to 0 (that caused a blank-frame flash).
 */
export function SwipePager({
  children,
  prevPage,
  nextPage,
  pageKey,
  onPrev,
  onNext,
  enabled = true,
}: Props) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const tx = useSharedValue(0);
  const locked = useSharedValue(false);

  useLayoutEffect(() => {
    cancelAnimation(tx);
    tx.value = 0;
    locked.value = false;
  }, [pageKey, tx, locked]);

  const settle = (dir: 1 | -1) => {
    if (dir === 1 && onNext) onNext();
    if (dir === -1 && onPrev) onPrev();
    // pageKey path: tx snaps in useLayoutEffect after the new center commits.
    if (!pageKey) {
      cancelAnimation(tx);
      tx.value = 0;
      locked.value = false;
    }
  };

  const finishSlide = (dir: 1 | -1) => {
    'worklet';
    if (reduceMotion) {
      // Instant commit — no fade-through-blank.
      runOnJS(settle)(dir);
      return;
    }
    const target = dir === 1 ? -width : width;
    tx.value = withTiming(target, { duration: MOTION_MED }, (done) => {
      if (!done) {
        locked.value = false;
        return;
      }
      // Keep opacity at 1. Incoming page is already painted in the neighbor slot.
      runOnJS(settle)(dir);
    });
  };

  const pan = Gesture.Pan()
    .enabled(enabled && Boolean(onPrev || onNext))
    .activeOffsetX([-36, 36])
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      if (locked.value) return;
      if (reduceMotion) return;
      const nextBlocked = event.translationX < 0 && !onNext;
      const prevBlocked = event.translationX > 0 && !onPrev;
      if (nextBlocked || prevBlocked) {
        tx.value = event.translationX * 0.18;
        return;
      }
      tx.value = event.translationX;
    })
    .onEnd((event) => {
      if (locked.value) return;
      const goRight = event.translationX > 56 || event.velocityX > 700;
      const goLeft = event.translationX < -56 || event.velocityX < -700;
      if (goLeft && onNext) {
        locked.value = true;
        finishSlide(1);
        return;
      }
      if (goRight && onPrev) {
        locked.value = true;
        finishSlide(-1);
        return;
      }
      tx.value = withSpring(0, SNAP_SPRING);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value - width }],
  }));

  const pageStyle = [styles.page, { width, backgroundColor: theme.bg }];

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.viewport, { backgroundColor: theme.bg }]}>
        <Animated.View style={[styles.track, { width: width * 3 }, animatedStyle]}>
          <View style={pageStyle} collapsable={false}>
            {prevPage}
          </View>
          <View style={pageStyle} collapsable={false}>
            {children}
          </View>
          <View style={pageStyle} collapsable={false}>
            {nextPage}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  page: { flex: 1, overflow: 'hidden' },
});
