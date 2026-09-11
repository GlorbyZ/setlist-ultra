import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_PREFS,
  parseDisplayPrefs,
  prefsFromPreset,
  type DisplayPrefs,
  type NamedPreset,
} from './prefs';

const STORE_KEY = 'setlist-ultra.displayPrefs';

type DisplayPrefsContextValue = {
  prefs: DisplayPrefs;
  patchPrefs: (patch: Partial<DisplayPrefs>) => void;
  applyPreset: (id: NamedPreset) => void;
};

const DisplayPrefsContext = createContext<DisplayPrefsContextValue | null>(null);

async function readPrefs(): Promise<DisplayPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, liveButtons: [...DEFAULT_PREFS.liveButtons] };
    return parseDisplayPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFS, liveButtons: [...DEFAULT_PREFS.liveButtons] };
  }
}

async function writePrefs(prefs: DisplayPrefs) {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(prefs));
  } catch {
    /* web / unavailable */
  }
}

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let cancelled = false;
    void readPrefs().then((next) => {
      if (!cancelled) setPrefs(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: DisplayPrefs) => {
    setPrefs(next);
    void writePrefs(next);
  }, []);

  const patchPrefs = useCallback(
    (patch: Partial<DisplayPrefs>) => {
      persist({
        ...prefs,
        ...patch,
        presetId: patch.presetId ?? 'custom',
        liveButtons: patch.liveButtons ? [...patch.liveButtons] : prefs.liveButtons,
        hiddenSectionKinds: Array.isArray(patch.hiddenSectionKinds)
          ? [...patch.hiddenSectionKinds]
          : prefs.hiddenSectionKinds,
      });
    },
    [persist, prefs],
  );

  const applyPreset = useCallback(
    (id: NamedPreset) => {
      persist(prefsFromPreset(id));
    },
    [persist],
  );

  const value = useMemo(
    () => ({ prefs, patchPrefs, applyPreset }),
    [prefs, patchPrefs, applyPreset],
  );

  return <DisplayPrefsContext.Provider value={value}>{children}</DisplayPrefsContext.Provider>;
}

export function useDisplayPrefs() {
  const ctx = useContext(DisplayPrefsContext);
  if (!ctx) {
    return {
      prefs: DEFAULT_PREFS,
      patchPrefs: (_patch: Partial<DisplayPrefs>) => undefined,
      applyPreset: (_id: NamedPreset) => undefined,
    };
  }
  return ctx;
}

export type { NamedPreset };
