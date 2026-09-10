import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BrandMark } from '@/src/components/BrandMark';
import { useTheme } from '@/src/theme';

type SongsChromeValue = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  /** @deprecated use menuOpen */
  drawerOpen: boolean;
  /** @deprecated use setMenuOpen */
  setDrawerOpen: (open: boolean) => void;
  /** @deprecated use toggleMenu */
  toggleDrawer: () => void;
};

const SongsChromeContext = createContext<SongsChromeValue | null>(null);

export function SongsChromeProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setMenuOpen(false);
    });
    return () => sub.remove();
  }, []);

  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), []);

  const value = useMemo(
    () => ({
      menuOpen,
      setMenuOpen,
      toggleMenu,
      drawerOpen: menuOpen,
      setDrawerOpen: setMenuOpen,
      toggleDrawer: toggleMenu,
    }),
    [menuOpen, toggleMenu],
  );

  return <SongsChromeContext.Provider value={value}>{children}</SongsChromeContext.Provider>;
}

export function useSongsChrome() {
  const ctx = useContext(SongsChromeContext);
  if (!ctx) throw new Error('useSongsChrome must be used within SongsChromeProvider');
  return ctx;
}

/** Spacer so the centered logo stays balanced against the right hamburger. */
export function SongsHeaderLeft() {
  return <View style={{ width: 42, paddingLeft: 8 }} />;
}

/** Center: SETLIST ULTRA wordmark. */
export function SongsHeaderTitle() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BrandMark height={40} />
    </View>
  );
}

/** Right: single overflow menu (library / lists). */
export function SongsHeaderRight() {
  const { theme } = useTheme();
  const { menuOpen, toggleMenu } = useSongsChrome();
  return (
    <View style={{ paddingRight: 8, justifyContent: 'center' }}>
      <Pressable
        onPress={toggleMenu}
        hitSlop={10}
        style={{ paddingHorizontal: 4, paddingVertical: 4 }}
        accessibilityRole="button"
        accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}>
        <Ionicons name={menuOpen ? 'close' : 'menu'} size={26} color={theme.text} />
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
