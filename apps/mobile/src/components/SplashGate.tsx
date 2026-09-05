import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';

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

  const glow = useSharedValue(0);
  const logo = useSharedValue(1);
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

    const finish = () => {
      setVisible(false);
      if (Platform.OS === 'ios') {
        void import('expo-haptics').then((Haptics) =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        );
      }
    };

    if (reduceMotion) {
      cover.value = 0;
      finish();
      return;
    }

    glow.value = withDelay(150, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
    logo.value = withDelay(
      200,
      withSpring(1, { damping: 16, stiffness: 180, mass: 0.7 }),
    );
    cover.value = withDelay(
      900,
      withTiming(0, { duration: 200, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [ready, reduceMotion, visible, cover, glow, logo]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.45,
    transform: [{ scale: 0.92 + glow.value * 0.08 }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: 0.92 + logo.value * 0.08 }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    opacity: cover.value,
  }));

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <Animated.View style={[styles.overlay, { backgroundColor: bg }, coverStyle]} pointerEvents="none">
          <Animated.View style={[styles.glowWrap, glowStyle]}>
            <LinearGradient
              colors={[brand.ultraMagenta, brand.ultraViolet, brand.ultraBlue]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.glow}
            />
          </Animated.View>
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
  glowWrap: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 4,
    overflow: 'hidden',
  },
  glow: { flex: 1, borderRadius: 140 },
  logo: { width: 240, height: 240 },
});
