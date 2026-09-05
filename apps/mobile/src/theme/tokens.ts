export type ThemeId = 'ultra-dark' | 'ultra-light' | 'stage' | 'system';
export type ResolvedThemeId = Exclude<ThemeId, 'system'>;

export const brand = {
  ultraMagenta: '#C401E3',
  ultraViolet: '#460CBC',
  ultraBlue: '#0080FF',
  ultraBlueDeep: '#0259EE',
  paper: '#FFFFFF',
  paperMuted: '#F5F5F7',
  paperLine: '#E5E5EA',
  ink: '#0A0A0C',
  mist: '#6B6B76',
  inkInverse: '#000000',
  snow: '#F5F5F7',
  danger: '#FF4D6D',
} as const;

export const BRAND_GRADIENT = [brand.ultraMagenta, brand.ultraViolet, brand.ultraBlue] as const;

export type AppTheme = {
  id: ResolvedThemeId;
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentText: string;
  danger: string;
  inputBg: string;
  radius: { sm: number; md: number; lg: number };
  gradient: readonly [string, string, string];
};

const radius = { sm: 4, md: 8, lg: 12 };

export const THEMES: Record<ResolvedThemeId, AppTheme> = {
  'ultra-light': {
    id: 'ultra-light',
    bg: brand.paper,
    panel: brand.paperMuted,
    border: brand.paperLine,
    text: brand.ink,
    muted: brand.mist,
    faint: '#8E8E93',
    accent: brand.ultraViolet,
    accentText: '#FFFFFF',
    danger: brand.danger,
    inputBg: brand.paper,
    radius,
    gradient: BRAND_GRADIENT,
  },
  'ultra-dark': {
    id: 'ultra-dark',
    bg: brand.inkInverse,
    panel: brand.ink,
    border: '#1C1C1F',
    text: brand.snow,
    muted: '#9A9AA3',
    faint: '#6B6B76',
    accent: brand.ultraBlue,
    accentText: '#FFFFFF',
    danger: brand.danger,
    inputBg: brand.ink,
    radius,
    gradient: BRAND_GRADIENT,
  },
  stage: {
    id: 'stage',
    bg: '#000000',
    panel: '#000000',
    border: '#141416',
    text: '#E8E8ED',
    muted: '#8E8E93',
    faint: '#636366',
    accent: brand.ultraBlue,
    accentText: '#FFFFFF',
    danger: brand.danger,
    inputBg: brand.ink,
    radius,
    gradient: [brand.ultraBlue, brand.ultraBlueDeep, brand.ultraBlue],
  },
};

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'ultra-light', label: 'Ultra Light' },
  { id: 'ultra-dark', label: 'Ultra Dark' },
  { id: 'stage', label: 'Stage' },
  { id: 'system', label: 'System' },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'ultra-light' || value === 'ultra-dark' || value === 'stage' || value === 'system';
}

export function resolveThemeId(themeId: ThemeId, systemDark: boolean): ResolvedThemeId {
  if (themeId === 'system') return systemDark ? 'ultra-dark' : 'ultra-light';
  return themeId;
}
