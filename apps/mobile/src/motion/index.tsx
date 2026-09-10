import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
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

/** Short branded springs — firm, not bouncy. */
export const PRESS_SPRING = { damping: 20, stiffness: 320, mass: 0.7 } as const;
export const SNAP_SPRING = { damping: 22, stiffness: 280, mass: 0.8 } as const;
export const MOTION_FAST = 160;
export const MOTION_MED = 220;

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

/** Subtle press feedback for buttons / icon hits. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressScaleProps) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      disabled={disabled}
      style={style}
      onPressIn={(e) => {
        if (!reduce && !disabled) scale.value = withSpring(scaleTo, PRESS_SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) scale.value = withSpring(1, PRESS_SPRING);
        onPressOut?.(e);
      }}
      {...rest}>
      <Animated.View style={[animatedStyle, { width: '100%' }]}>{children}</Animated.View>
    </Pressable>
  );
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
