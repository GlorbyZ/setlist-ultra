import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

import { BrandMark } from '@/src/components/BrandMark';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useTheme } from '@/src/theme';

type Props = {
  fontsReady: boolean;
  children: ReactNode;
};

export function SplashGate({ fontsReady, children }: Props) {
  const { loading } = useLibrary();
  const { theme } = useTheme();
  const ready = fontsReady && !loading;
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const logo = useSharedValue(0.92);
  const cover = useSharedValue(1);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hideNative = () => {
      if (cancelled) return;
      void SplashScreen.hideAsync().catch(() => undefined);
    };
    const frame = requestAnimationFrame(hideNative);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!ready || !visible) return;

    const finish = () => setVisible(false);

    if (reduceMotion) {
      cover.value = 0;
      finish();
      return;
    }

    logo.value = withDelay(80, withSpring(1, { damping: 16, stiffness: 180, mass: 0.7 }));
    cover.value = withDelay(
      700,
      withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [ready, reduceMotion, visible, cover, logo]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: logo.value }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    opacity: cover.value,
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {children}
      {visible ? (
        <Animated.View
          style={[styles.overlay, coverStyle, { backgroundColor: theme.bg }]}
          pointerEvents="none"
          collapsable={false}>
          <Animated.View style={logoStyle}>
            <BrandMark height={72} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});
