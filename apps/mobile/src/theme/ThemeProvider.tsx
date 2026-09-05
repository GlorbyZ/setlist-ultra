import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { createContext, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';

import { getAppState, patchAppState } from '@/src/lib/repository';
import {
  THEMES,
  isThemeId,
  resolveThemeId,
  type AppTheme,
  type ThemeId,
} from './tokens';

const THEME_KEY = 'setlist-ultra.themeId';

type ThemeContextValue = {
  theme: AppTheme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredThemeId(): Promise<ThemeId | null> {
  try {
    const value = await SecureStore.getItemAsync(THEME_KEY);
    if (isThemeId(value)) return value;
  } catch {
    /* web / unavailable */
  }
  return null;
}

async function writeStoredThemeId(id: ThemeId) {
  try {
    await SecureStore.setItemAsync(THEME_KEY, id);
  } catch {
    /* ignore */
  }
}

function applyColorScheme(themeId: ThemeId) {
  if (themeId === 'system') {
    Appearance.setColorScheme(null as unknown as 'light');
    return;
  }
  Appearance.setColorScheme(themeId === 'ultra-light' ? 'light' : 'dark');
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeId, setThemeIdState] = useState<ThemeId>('ultra-light');

  const resolved = resolveThemeId(themeId, systemScheme === 'dark');
  const theme = THEMES[resolved];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromSecure = await readStoredThemeId();
      let next: ThemeId = fromSecure ?? 'ultra-light';
      try {
        const state = await getAppState();
        if (isThemeId(state.themeId)) next = state.themeId;
      } catch {
        /* first launch / migration */
      }
      if (cancelled) return;
      setThemeIdState(next);
      applyColorScheme(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback(async (id: ThemeId) => {
    setThemeIdState(id);
    applyColorScheme(id);
    await writeStoredThemeId(id);
    try {
      await patchAppState({ themeId: id });
    } catch {
      /* DB may still be opening */
    }
  }, []);

  const value = useMemo(() => ({ theme, themeId, setThemeId }), [theme, themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: THEMES['ultra-light'],
      themeId: 'ultra-light' as ThemeId,
      setThemeId: async () => undefined,
    };
  }
  return ctx;
}
