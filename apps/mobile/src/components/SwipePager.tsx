import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_MED, SNAP_SPRING, useReduceMotion } from '@/src/motion';
import { useTheme } from '@/src/theme';

export type SwipePagerPage = {
  key: string;
  /** Absolute index in the Live queue — stable across prev/center/next role changes. */
  queueIndex: number;
  content: ReactNode;
};

type Props = {
  index: number;
  pages: SwipePagerPage[];
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
};

/**
 * Gallery swipe that keeps song instances keyed by id.
 * Active index lives on the UI thread so settle does not flash the wrong page
 * or remount the incoming chart (chords / scroll stay put).
 */
export function SwipePager({ index, pages, onPrev, onNext, enabled = true }: Props) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const reduceSV = useSharedValue(reduceMotion);
  const gestureTx = useSharedValue(0);
  const activeIndex = useSharedValue(index);
  const widthSV = useSharedValue(width);
  const locked = useSharedValue(false);
  const canPrev = useSharedValue(Boolean(onPrev));
  const canNext = useSharedValue(Boolean(onNext));

  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;

  useEffect(() => {
    reduceSV.value = reduceMotion;
  }, [reduceMotion, reduceSV]);

  useEffect(() => {
    widthSV.value = width;
  }, [width, widthSV]);

  useEffect(() => {
    canPrev.value = Boolean(onPrev);
    canNext.value = Boolean(onNext);
  }, [onPrev, onNext, canPrev, canNext]);

  useLayoutEffect(() => {
    cancelAnimation(gestureTx);
    activeIndex.value = index;
    gestureTx.value = 0;
    locked.value = false;
  }, [index, activeIndex, gestureTx, locked]);

  const commit = (dir: 1 | -1) => {
    if (dir === 1) onNextRef.current?.();
    else onPrevRef.current?.();
  };

  const finishSlide = (dir: 1 | -1) => {
    'worklet';
    const w = widthSV.value;
    if (reduceSV.value) {
      activeIndex.value = activeIndex.value + dir;
      gestureTx.value = 0;
      locked.value = false;
      runOnJS(commit)(dir);
      return;
    }
    gestureTx.value = withTiming(-dir * w, { duration: MOTION_MED }, (done) => {
      if (!done) {
        locked.value = false;
        return;
      }
      // Same-frame visual: incoming page is already centered via activeIndex.
      activeIndex.value = activeIndex.value + dir;
      gestureTx.value = 0;
      runOnJS(commit)(dir);
    });
  };

  const pan = Gesture.Pan()
    .enabled(enabled && Boolean(onPrev || onNext))
    .activeOffsetX([-36, 36])
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      if (locked.value) return;
      if (reduceSV.value) return;
      const nextBlocked = event.translationX < 0 && !canNext.value;
      const prevBlocked = event.translationX > 0 && !canPrev.value;
      if (nextBlocked || prevBlocked) {
        gestureTx.value = event.translationX * 0.18;
        return;
      }
      gestureTx.value = event.translationX;
    })
    .onEnd((event) => {
      if (locked.value) return;
      const goRight = event.translationX > 56 || event.velocityX > 700;
      const goLeft = event.translationX < -56 || event.velocityX < -700;
      if (goLeft && canNext.value) {
        locked.value = true;
        finishSlide(1);
        return;
      }
      if (goRight && canPrev.value) {
        locked.value = true;
        finishSlide(-1);
        return;
      }
      gestureTx.value = withSpring(0, SNAP_SPRING);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.viewport, { backgroundColor: theme.bg }]}>
        {pages.map((page) => (
          <SwipePage
            key={page.key}
            queueIndex={page.queueIndex}
            activeIndex={activeIndex}
            gestureTx={gestureTx}
            widthSV={widthSV}
            pointerEvents={page.queueIndex === index ? 'auto' : 'none'}>
            {page.content}
          </SwipePage>
        ))}
      </View>
    </GestureDetector>
  );
}

function SwipePage({
  queueIndex,
  activeIndex,
  gestureTx,
  widthSV,
  pointerEvents,
  children,
}: {
  queueIndex: number;
  activeIndex: SharedValue<number>;
  gestureTx: SharedValue<number>;
  widthSV: SharedValue<number>;
  pointerEvents: 'auto' | 'none';
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const style = useAnimatedStyle(() => ({
    width: widthSV.value,
    transform: [{ translateX: (queueIndex - activeIndex.value) * widthSV.value + gestureTx.value }],
  }));

  return (
    <Animated.View
      collapsable={false}
      pointerEvents={pointerEvents}
      style={[styles.page, { backgroundColor: theme.bg }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
