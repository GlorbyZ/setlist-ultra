import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from './ThemeProvider';
import { THEMES, type AppTheme } from './tokens';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function useThemedStyles<T extends NamedStyles<T>>(factory: (theme: AppTheme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}

export { AppThemeProvider, useTheme } from './ThemeProvider';
export {
  THEMES,
  THEME_OPTIONS,
  BRAND_GRADIENT,
  brand,
  isThemeId,
  resolveThemeId,
  type AppTheme,
  type ThemeId,
  type ResolvedThemeId,
} from './tokens';

/** @deprecated Prefer `useTheme().theme`. Kept so leftover screens compile. */
export const colors = THEMES['ultra-light'];
