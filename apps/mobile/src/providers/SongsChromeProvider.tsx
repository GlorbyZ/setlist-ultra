import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BrandMark } from '@/src/components/BrandMark';
import { useTheme } from '@/src/theme';

type SongsChromeValue = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
};

const SongsChromeContext = createContext<SongsChromeValue | null>(null);

export function SongsChromeProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setDrawerOpen(false);
    });
    return () => sub.remove();
  }, []);

  const toggleDrawer = useCallback(() => setDrawerOpen((open) => !open), []);

  const value = useMemo(
    () => ({ drawerOpen, setDrawerOpen, toggleDrawer }),
    [drawerOpen, toggleDrawer],
  );

  return <SongsChromeContext.Provider value={value}>{children}</SongsChromeContext.Provider>;
}

export function useSongsChrome() {
  const ctx = useContext(SongsChromeContext);
  if (!ctx) throw new Error('useSongsChrome must be used within SongsChromeProvider');
  return ctx;
}

/** Left: opens/closes the downward filters/library expansion. */
export function SongsHeaderLeft() {
  const { theme } = useTheme();
  const { drawerOpen, toggleDrawer } = useSongsChrome();
  return (
    <View style={{ paddingLeft: 8, justifyContent: 'center' }}>
      <Pressable
        onPress={toggleDrawer}
        hitSlop={10}
        style={{ paddingHorizontal: 4, paddingVertical: 4 }}
        accessibilityRole="button"
        accessibilityLabel={drawerOpen ? 'Collapse filters' : 'Expand filters'}>
        <Ionicons name={drawerOpen ? 'chevron-up' : 'chevron-down'} size={26} color={theme.text} />
      </Pressable>
    </View>
  );
}

/** Center: SETLIST ULTRA wordmark. */
export function SongsHeaderTitle() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BrandMark height={40} />
    </View>
  );
}

/** Right: hamburger menu (same panel as left expansion). */
export function SongsHeaderRight() {
  const { theme } = useTheme();
  const { drawerOpen, toggleDrawer } = useSongsChrome();
  return (
    <View style={{ paddingRight: 8, justifyContent: 'center' }}>
      <Pressable
        onPress={toggleDrawer}
        hitSlop={10}
        style={{ paddingHorizontal: 4, paddingVertical: 4 }}
        accessibilityRole="button"
        accessibilityLabel={drawerOpen ? 'Close menu' : 'Open menu'}>
        <Ionicons name={drawerOpen ? 'close' : 'menu'} size={26} color={theme.text} />
      </Pressable>
    </View>
  );
}

export function TabsHeaderLeft() {
  return (
    <View style={{ paddingLeft: 8, justifyContent: 'center' }}>
      <BrandMark height={48} />
    </View>
  );
}
