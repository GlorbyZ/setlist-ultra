import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_FAST, MOTION_MED, SNAP_SPRING, useReduceMotion } from '@/src/motion';

type Props = {
  children: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
};

export function SwipePager({ children, onPrev, onNext, enabled = true }: Props) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const locked = useSharedValue(false);

  const settleInstant = (dir: 1 | -1) => {
    if (dir === 1 && onNext) onNext();
    if (dir === -1 && onPrev) onPrev();
    tx.value = 0;
    opacity.value = 1;
    locked.value = false;
  };

  const finishSlide = (dir: 1 | -1) => {
    'worklet';
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: MOTION_FAST }, (done) => {
        if (!done) {
          locked.value = false;
          return;
        }
        runOnJS(settleInstant)(dir);
        opacity.value = withTiming(1, { duration: MOTION_FAST });
      });
      return;
    }
    const target = dir === 1 ? -width : width;
    tx.value = withTiming(target, { duration: MOTION_MED }, (done) => {
      if (!done) {
        locked.value = false;
        return;
      }
      runOnJS(settleInstant)(dir);
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
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
