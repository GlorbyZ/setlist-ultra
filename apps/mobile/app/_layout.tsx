import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { LibraryProvider } from '@/src/providers/LibraryProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (error) console.error('Font load failed:', error);
    if (loaded || error) setReady(true);
  }, [loaded, error]);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <LibraryProvider>
      <RootLayoutNav />
    </LibraryProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="song/[id]" options={{ title: 'Live', headerLargeTitle: false }} />
        <Stack.Screen name="editor/[id]" options={{ title: 'Editor' }} />
        <Stack.Screen name="setlist/[id]" options={{ title: 'Set' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal', title: 'Add music' }} />
        <Stack.Screen name="groups" options={{ title: 'Groups' }} />
      </Stack>
    </ThemeProvider>
  );
}
