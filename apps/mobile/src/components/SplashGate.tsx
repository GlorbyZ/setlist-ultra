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

import { useLibrary } from '@/src/providers/LibraryProvider';
import { brand, useTheme } from '@/src/theme';

const logoMain = require('../../assets/brand/logo-main.png');
const logoWhite = require('../../assets/brand/logo-white.png');

type Props = {
  fontsReady: boolean;
  children: ReactNode;
};

export function SplashGate({ fontsReady, children }: Props) {
  const { theme } = useTheme();
  const { loading } = useLibrary();
  const ready = fontsReady && !loading;
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const logo = useSharedValue(0.92);
  const cover = useSharedValue(1);

  const light = theme.id === 'ultra-light';
  const bg = light ? brand.paper : '#000000';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync();
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
    <View style={styles.root}>
      {children}
      {visible ? (
        <Animated.View style={[styles.overlay, { backgroundColor: bg }, coverStyle]} pointerEvents="none">
          <Animated.Image
            source={light ? logoMain : logoWhite}
            resizeMode="contain"
            style={[styles.logo, logoStyle]}
          />
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
  logo: { width: 240, height: 240 },
});
