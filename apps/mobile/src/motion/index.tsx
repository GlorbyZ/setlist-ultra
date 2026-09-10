import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Firm <=150ms press — snappy, not mushy. */
export const PRESS_SPRING = { damping: 36, stiffness: 650, mass: 0.35 } as const;
export const SNAP_SPRING = { damping: 32, stiffness: 520, mass: 0.45 } as const;
/** Preferred press settle window (ms). */
export const PRESS_MS = 90;
export const MOTION_FAST = 140;
export const MOTION_MED = 200;

/** Instant pressed opacity for list rows / scrollable hits (no transform). */
export const PRESSED_OPACITY = 0.72;

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(Boolean(value));
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduce(Boolean(value));
    });
    return () => {
      alive = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sub as any)?.remove?.();
    };
  }, []);
  return reduce;
}

type PressScaleProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/**
 * Immediate press-in feedback (scale). Action still runs on press/pressOut.
 * unstable_pressDelay forced to 0 so Android does not wait ~130ms before feedback.
 * Reduce-motion: tiny opacity flash, no scale.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  disabled,
  onPressIn,
  onPressOut,
  unstable_pressDelay,
  ...rest
}: PressScaleProps) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      disabled={disabled}
      style={style}
      onPressIn={(e) => {
        if (!disabled) {
          if (reduce) {
            opacity.value = withTiming(0.55, { duration: 1 });
          } else {
            scale.value = withSpring(scaleTo, PRESS_SPRING);
          }
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (reduce) {
          opacity.value = withTiming(1, { duration: PRESS_MS });
        } else {
          scale.value = withSpring(1, PRESS_SPRING);
        }
        onPressOut?.(e);
      }}
      {...rest}
      unstable_pressDelay={unstable_pressDelay ?? 0}>
      <Animated.View style={[animatedStyle, { width: '100%' }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Scroll-safe pressed style for FlatList/ScrollView rows.
 * Opacity only — no transform that can fight gesture recognition.
 */
export function pressedStyle(
  base?: StyleProp<ViewStyle>,
  pressedExtra?: StyleProp<ViewStyle>,
): PressableProps['style'] {
  return ({ pressed }) => [base, pressed ? (pressedExtra ?? { opacity: PRESSED_OPACITY }) : null];
}

type ExpandProps = {
  open: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Opacity expand-collapse for downward panels. */
export function ExpandCollapse({ open, children, style }: ExpandProps) {
  const reduce = useReduceMotion();
  if (!open) return null;
  if (reduce) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }
  return (
    <Animated.View
      style={style}
      entering={FadeIn.duration(MOTION_FAST).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(MOTION_FAST)}
      layout={LinearTransition.duration(MOTION_MED)}>
      {children}
    </Animated.View>
  );
}

export function fadeTiming(to: number, ms = MOTION_MED) {
  'worklet';
  return withTiming(to, { duration: ms, easing: Easing.out(Easing.cubic) });
}