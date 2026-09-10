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

import { MOTION_FAST, MOTION_MED, SNAP_SPRING, useReduceMotion } from '@/src/motion';
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
  const opacity = useSharedValue(1);
  const locked = useSharedValue(false);

  // After JS commits the new center page, snap transform on this layout pass
  // before paint. cancelAnimation avoids a late withTiming frame painting the
  // outgoing chart on top of the incoming page (swipe ghost/flash).
  useLayoutEffect(() => {
    cancelAnimation(tx);
    cancelAnimation(opacity);
    tx.value = 0;
    opacity.value = 1;
    locked.value = false;
  }, [pageKey, opacity, tx, locked]);

  const settle = (dir: 1 | -1) => {
    if (dir === 1 && onNext) onNext();
    if (dir === -1 && onPrev) onPrev();
    if (!pageKey) {
      cancelAnimation(tx);
      cancelAnimation(opacity);
      tx.value = 0;
      opacity.value = 1;
      locked.value = false;
    }
  };

  const finishSlide = (dir: 1 | -1) => {
    'worklet';
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: MOTION_FAST }, (done) => {
        if (!done) {
          locked.value = false;
          return;
        }
        runOnJS(settle)(dir);
      });
      return;
    }
    const target = dir === 1 ? -width : width;
    tx.value = withTiming(target, { duration: MOTION_MED }, (done) => {
      if (!done) {
        locked.value = false;
        return;
      }
      // Hide for the commit frame so a stale tx cannot flash the wrong slot
      // (or the outgoing song) while React swaps prev/center/next.
      opacity.value = 0;
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
    opacity: opacity.value,
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
