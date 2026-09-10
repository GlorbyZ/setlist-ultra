import { brand, type AppTheme } from '@/src/theme';

export type PresetId = 'stage' | 'practice' | 'teleprompter' | 'compact' | 'custom';
export type LiveButtonId = 'section' | 'key' | 'capo' | 'scroll' | 'lyrics' | 'zoom' | 'metro';
export type LayoutMode = 'auto' | 'scroll' | 'pages';
export type LongLines = 'wrap' | 'shrink' | 'split';
export type ChordColorToken = 'accent' | 'brand';
export type Notation = 'standard' | 'nashville' | 'german' | 'latin';
export type AppBarMode = 'auto-hide' | 'always';

export type DisplayPrefs = {
  presetId: PresetId;
  chartFontSize: number;
  chordFontScale: number;
  chordColor: ChordColorToken;
  showTitle: boolean;
  showMeta: boolean;
  showSectionHeaders: boolean;
  lyricsOnlyDefault: boolean;
  chartPadding: number;
  longLines: LongLines;
  notation: Notation;
  layoutMode: LayoutMode;
  highContrast: boolean;
  liveButtons: LiveButtonId[];
  appBarMode: AppBarMode;
};

export const DEFAULT_LIVE_BUTTONS: LiveButtonId[] = [
  'section',
  'key',
  'capo',
  'scroll',
  'lyrics',
  'zoom',
];

export const ALL_LIVE_BUTTONS: { id: LiveButtonId; label: string; hint: string }[] = [
  { id: 'section', label: 'Section', hint: 'Jump verse / chorus' },
  { id: 'key', label: 'Key', hint: 'Concert key picker' },
  { id: 'capo', label: 'Capo', hint: 'Capo fret' },
  { id: 'scroll', label: 'Scroll', hint: 'Autoscroll the chart' },
  { id: 'lyrics', label: 'Lyrics', hint: 'Hide or show chords' },
  { id: 'zoom', label: 'Zoom', hint: 'Bigger / smaller type' },
  { id: 'metro', label: 'Metro', hint: 'Tempo label' },
];

export const DEFAULT_PREFS: DisplayPrefs = {
  presetId: 'practice',
  chartFontSize: 18,
  chordFontScale: 1,
  chordColor: 'accent',
  showTitle: true,
  showMeta: true,
  showSectionHeaders: true,
  lyricsOnlyDefault: false,
  chartPadding: 20,
  longLines: 'wrap',
  notation: 'standard',
  layoutMode: 'scroll',
  highContrast: false,
  liveButtons: [...DEFAULT_LIVE_BUTTONS],
  appBarMode: 'auto-hide',
};

export type NamedPreset = Exclude<PresetId, 'custom'>;

export const PRESET_INFO: { id: NamedPreset; title: string; intent: string }[] = [
  { id: 'stage', title: 'Stage', intent: 'Dark-friendly, large lyrics, high-contrast chords, scroll' },
  { id: 'practice', title: 'Practice', intent: 'Normal size, section headers and meta on' },
  { id: 'teleprompter', title: 'Teleprompter', intent: 'Huge lyrics, chords hidden' },
  { id: 'compact', title: 'Compact tablet', intent: 'Smaller type for landscape' },
];

const PRESETS: Record<NamedPreset, DisplayPrefs> = {
  stage: {
    ...DEFAULT_PREFS,
    presetId: 'stage',
    chartFontSize: 22,
    chordFontScale: 1.15,
    chordColor: 'accent',
    showTitle: true,
    showMeta: true,
    showSectionHeaders: true,
    lyricsOnlyDefault: false,
    chartPadding: 16,
    highContrast: true,
    layoutMode: 'scroll',
    appBarMode: 'auto-hide',
  },
  practice: { ...DEFAULT_PREFS, presetId: 'practice' },
  teleprompter: {
    ...DEFAULT_PREFS,
    presetId: 'teleprompter',
    chartFontSize: 28,
    chordFontScale: 0.85,
    lyricsOnlyDefault: true,
    chartPadding: 12,
    showSectionHeaders: true,
    showMeta: false,
    highContrast: true,
    layoutMode: 'scroll',
    liveButtons: ['scroll', 'lyrics', 'zoom', 'section'],
  },
  compact: {
    ...DEFAULT_PREFS,
    presetId: 'compact',
    chartFontSize: 16,
    chordFontScale: 1,
    chartPadding: 12,
    layoutMode: 'pages',
    showMeta: true,
  },
};

export function prefsFromPreset(id: NamedPreset): DisplayPrefs {
  return { ...PRESETS[id], liveButtons: [...PRESETS[id].liveButtons] };
}

export function clampFontSize(size: number) {
  return Math.min(32, Math.max(14, Math.round(size)));
}

export function clampChartPadding(size: number) {
  return Math.min(40, Math.max(8, Math.round(size)));
}

export function parseDisplayPrefs(raw: unknown): DisplayPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS, liveButtons: [...DEFAULT_LIVE_BUTTONS] };
  const row = raw as Partial<DisplayPrefs>;
  const buttons = Array.isArray(row.liveButtons)
    ? row.liveButtons.filter((id): id is LiveButtonId => ALL_LIVE_BUTTONS.some((item) => item.id === id))
    : [...DEFAULT_LIVE_BUTTONS];
  return {
    ...DEFAULT_PREFS,
    ...row,
    chartFontSize: clampFontSize(Number(row.chartFontSize) || DEFAULT_PREFS.chartFontSize),
    chartPadding: clampChartPadding(Number(row.chartPadding) || DEFAULT_PREFS.chartPadding),
    chordFontScale: Math.min(1.4, Math.max(0.85, Number(row.chordFontScale) || 1)),
    longLines: row.longLines === 'shrink' || row.longLines === 'split' ? row.longLines : 'wrap',
    notation:
      row.notation === 'nashville' || row.notation === 'german' || row.notation === 'latin'
        ? row.notation
        : 'standard',
    layoutMode: row.layoutMode === 'auto' || row.layoutMode === 'pages' ? row.layoutMode : 'scroll',
    appBarMode: row.appBarMode === 'always' ? 'always' : 'auto-hide',
    chordColor: row.chordColor === 'brand' ? 'brand' : 'accent',
    showTitle: row.showTitle !== false,
    showMeta: row.showMeta !== false,
    showSectionHeaders: row.showSectionHeaders !== false,
    lyricsOnlyDefault: Boolean(row.lyricsOnlyDefault),
    highContrast: Boolean(row.highContrast),
    liveButtons: buttons.length ? buttons : [...DEFAULT_LIVE_BUTTONS],
  };
}

export function resolveChordColor(theme: AppTheme, prefs: DisplayPrefs): string {
  if (prefs.highContrast) return theme.accent;
  if (prefs.chordColor === 'brand') return brand.ultraMagenta;
  return theme.accent;
}

export function chordModeFromPrefs(prefs: DisplayPrefs): 'normal' | 'larger' | 'hidden' {
  if (prefs.lyricsOnlyDefault) return 'hidden';
  if (prefs.chordFontScale >= 1.12) return 'larger';
  return 'normal';
}

export function prefsForChordMode(
  prefs: DisplayPrefs,
  mode: 'normal' | 'larger' | 'hidden',
): Partial<DisplayPrefs> {
  if (mode === 'hidden') return { lyricsOnlyDefault: true, presetId: 'custom' };
  if (mode === 'larger') return { lyricsOnlyDefault: false, chordFontScale: 1.2, presetId: 'custom' };
  return { lyricsOnlyDefault: false, chordFontScale: 1, presetId: 'custom' };
}
