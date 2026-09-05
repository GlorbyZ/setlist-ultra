import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ShareIntentProvider } from 'expo-share-intent';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { IncomingShare } from '@/src/components/IncomingShare';
import { SplashGate } from '@/src/components/SplashGate';
import { LibraryProvider } from '@/src/providers/LibraryProvider';
import { AppThemeProvider, useTheme } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) console.error('Font load failed:', error);
  }, [error]);

  const fontsReady = loaded || Boolean(error);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ShareIntentProvider>
        <AppThemeProvider>
          <LibraryProvider>
            <SplashGate fontsReady={fontsReady}>
              <IncomingShare />
              <RootLayoutNav />
            </SplashGate>
          </LibraryProvider>
        </AppThemeProvider>
      </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { theme } = useTheme();
  const navTheme = useMemo(() => {
    const base = theme.id === 'ultra-light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accent,
        background: theme.bg,
        card: theme.bg,
        text: theme.text,
        border: theme.border,
        notification: theme.danger,
      },
    };
  }, [theme]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.id === 'ultra-light' ? 'dark' : 'light'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="song/[id]" options={{ title: '', headerShadowVisible: false }} />
        <Stack.Screen name="editor/[id]" options={{ title: 'Editor' }} />
        <Stack.Screen name="setlist/[id]" options={{ title: 'Set' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal', title: 'Import' }} />
        <Stack.Screen name="groups" options={{ title: 'Groups' }} />
      </Stack>
    </ThemeProvider>
  );
}
