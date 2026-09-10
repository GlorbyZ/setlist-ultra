import { Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Themed';
import { ChartStylePreview } from '@/src/components/ChartStylePreview';
import { useDisplayPrefs } from '@/src/display/DisplayPrefsProvider';
import {
  ALL_LIVE_BUTTONS,
  PRESET_INFO,
  chordModeFromPrefs,
  clampChartPadding,
  clampFontSize,
  prefsForChordMode,
  type LayoutMode,
  type LiveButtonId,
  type LongLines,
  type NamedPreset,
  type Notation,
} from '@/src/display/prefs';
import { THEME_OPTIONS, brand, useTheme, useThemedStyles, type AppTheme, type ThemeId } from '@/src/theme';

export default function LookAndStageScreen() {
  const { theme, themeId, setThemeId } = useTheme();
  const { prefs, patchPrefs, applyPreset } = useDisplayPrefs();
  const styles = useThemedStyles(makeStyles);
  const chordMode = chordModeFromPrefs(prefs);

  const pickPreset = (id: NamedPreset) => {
    applyPreset(id);
    if (id === 'stage' || id === 'teleprompter') void setThemeId('stage');
    else if (id === 'practice') void setThemeId('ultra-light');
  };

  const moveButton = (id: LiveButtonId, dir: -1 | 1) => {
    const list = [...prefs.liveButtons];
    const at = list.indexOf(id);
    if (at < 0) return;
    const next = at + dir;
    if (next < 0 || next >= list.length) return;
    const swap = list[next];
    list[next] = id;
    list[at] = swap;
    patchPrefs({ liveButtons: list });
  };

  const toggleButton = (id: LiveButtonId) => {
    const on = prefs.liveButtons.includes(id);
    patchPrefs({
      liveButtons: on ? prefs.liveButtons.filter((item) => item !== id) : [...prefs.liveButtons, id],
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Look & Stage' }} />

      <ChartStylePreview />

      <Text style={styles.heading}>Presets</Text>
      <Text style={styles.lede}>One tap fills chart, layout, and stage tools. Tweak anything below.</Text>
      {PRESET_INFO.map((preset) => {
        const on = prefs.presetId === preset.id;
        return (
          <Pressable
            key={preset.id}
            style={[styles.preset, on && styles.presetOn]}
            onPress={() => pickPreset(preset.id)}>
            <Text style={[styles.presetTitle, on && styles.presetTitleOn]}>{preset.title}</Text>
            <Text style={styles.presetIntent}>{preset.intent}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.ghost} onPress={() => pickPreset('practice')}>
        <Text style={styles.ghostText}>Reset to Practice</Text>
      </Pressable>

      <Text style={styles.heading}>Room lighting</Text>
      <View style={styles.rowWrap}>
        {THEME_OPTIONS.map((option) => {
          const on = themeId === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => void setThemeId(option.id as ThemeId)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.heading}>Chart</Text>
      <Text style={styles.lede}>Text size</Text>
      <View style={styles.sizeRow}>
        <Pressable
          style={styles.sizeBtn}
          onPress={() => patchPrefs({ chartFontSize: clampFontSize(prefs.chartFontSize - 2) })}>
          <Text style={styles.sizeBtnLabel}>A−</Text>
        </Pressable>
        <Text style={styles.sizeValue}>{prefs.chartFontSize}</Text>
        <Pressable
          style={styles.sizeBtn}
          onPress={() => patchPrefs({ chartFontSize: clampFontSize(prefs.chartFontSize + 2) })}>
          <Text style={styles.sizeBtnLabel}>A+</Text>
        </Pressable>
      </View>

      <Text style={styles.lede}>Chords</Text>
      <View style={styles.rowWrap}>
        {(['normal', 'larger', 'hidden'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.chip, chordMode === mode && styles.chipOn]}
            onPress={() => patchPrefs(prefsForChordMode(prefs, mode))}>
            <Text style={[styles.chipText, chordMode === mode && styles.chipTextOn]}>
              {mode === 'normal' ? 'Normal' : mode === 'larger' ? 'Larger' : 'Hidden'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.lede}>Chord color</Text>
      <View style={styles.rowWrap}>
        <Pressable
          style={[styles.chip, prefs.chordColor === 'accent' && styles.chipOn]}
          onPress={() => patchPrefs({ chordColor: 'accent' })}>
          <View style={[styles.swatch, { backgroundColor: theme.accent }]} />
          <Text style={[styles.chipText, prefs.chordColor === 'accent' && styles.chipTextOn]}>Accent</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, prefs.chordColor === 'brand' && styles.chipOn]}
          onPress={() => patchPrefs({ chordColor: 'brand' })}>
          <View style={[styles.swatch, { backgroundColor: brand.ultraMagenta }]} />
          <Text style={[styles.chipText, prefs.chordColor === 'brand' && styles.chipTextOn]}>Brand</Text>
        </Pressable>
      </View>

      <Text style={styles.lede}>Page margin</Text>
      <View style={styles.rowWrap}>
        {(
          [
            [12, 'Tight'],
            [20, 'Comfortable'],
            [32, 'Roomy'],
          ] as const
        ).map(([size, label]) => (
          <Pressable
            key={label}
            style={[styles.chip, prefs.chartPadding === size && styles.chipOn]}
            onPress={() => patchPrefs({ chartPadding: clampChartPadding(size) })}>
            <Text style={[styles.chipText, prefs.chartPadding === size && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.lede}>Show on chart</Text>
      <ToggleRow
        styles={styles}
        label="Title"
        on={prefs.showTitle}
        onPress={() => patchPrefs({ showTitle: !prefs.showTitle })}
      />
      <ToggleRow
        styles={styles}
        label="Key / capo strip"
        on={prefs.showMeta}
        onPress={() => patchPrefs({ showMeta: !prefs.showMeta })}
      />
      <ToggleRow
        styles={styles}
        label="Section names"
        on={prefs.showSectionHeaders}
        onPress={() => patchPrefs({ showSectionHeaders: !prefs.showSectionHeaders })}
      />

      <Text style={styles.lede}>Long lines</Text>
      <View style={styles.rowWrap}>
        {(['wrap', 'shrink', 'split'] as LongLines[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.chip, prefs.longLines === mode && styles.chipOn]}
            onPress={() => patchPrefs({ longLines: mode })}>
            <Text style={[styles.chipText, prefs.longLines === mode && styles.chipTextOn]}>
              {mode === 'wrap' ? 'Wrap' : mode === 'shrink' ? 'Shrink' : 'Split'}
            </Text>
          </Pressable>
        ))}
      </View>
      {prefs.longLines === 'split' ? (
        <Text style={styles.hint}>Splits very long lyrics onto a second line. Column split comes later.</Text>
      ) : null}

      <Text style={styles.heading}>Layout</Text>
      <View style={styles.rowWrap}>
        {(['auto', 'scroll', 'pages'] as LayoutMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.chip, prefs.layoutMode === mode && styles.chipOn]}
            onPress={() => patchPrefs({ layoutMode: mode })}>
            <Text style={[styles.chipText, prefs.layoutMode === mode && styles.chipTextOn]}>
              {mode === 'auto' ? 'Auto' : mode === 'scroll' ? 'Scroll' : 'Pages'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {prefs.layoutMode === 'auto'
          ? 'Fit when the chart is short; otherwise scroll.'
          : prefs.layoutMode === 'scroll'
            ? 'One column. Best with autoscroll.'
            : 'Keep song-to-song swipe. Intra-song page split comes later.'}
      </Text>
      <ToggleRow
        styles={styles}
        label="Stage-readable"
        hint="High-contrast chords"
        on={prefs.highContrast}
        onPress={() => patchPrefs({ highContrast: !prefs.highContrast })}
      />

      <Text style={styles.heading}>Stage tools</Text>
      <Text style={styles.lede}>What appears in Live. Order is top to bottom in the toolbox.</Text>
      {ALL_LIVE_BUTTONS.map((item) => {
        const on = prefs.liveButtons.includes(item.id);
        return (
          <View key={item.id} style={styles.toolRow}>
            <Pressable style={styles.toolMain} onPress={() => toggleButton(item.id)}>
              <Text style={[styles.toolLabel, on && styles.toolLabelOn]}>{on ? 'On' : 'Off'}</Text>
              <View style={styles.toolCopy}>
                <Text style={styles.presetTitle}>{item.label}</Text>
                <Text style={styles.presetIntent}>{item.hint}</Text>
              </View>
            </Pressable>
            {on ? (
              <View style={styles.toolMove}>
                <Pressable onPress={() => moveButton(item.id, -1)} style={styles.moveBtn}>
                  <Text style={styles.moveText}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveButton(item.id, 1)} style={styles.moveBtn}>
                  <Text style={styles.moveText}>↓</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      <ToggleRow
        styles={styles}
        label="Keep Live tools visible"
        hint="Otherwise they fade after a few seconds"
        on={prefs.appBarMode === 'always'}
        onPress={() => patchPrefs({ appBarMode: prefs.appBarMode === 'always' ? 'auto-hide' : 'always' })}
      />
      <View style={styles.strip}>
        {prefs.liveButtons.map((id) => (
          <View key={id} style={styles.stripChip}>
            <Text style={styles.stripText}>{ALL_LIVE_BUTTONS.find((item) => item.id === id)?.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.heading}>Advanced</Text>
      <Text style={styles.lede}>Chord notation (stored now; Live still shows Standard)</Text>
      <View style={styles.rowWrap}>
        {(
          [
            ['standard', 'Standard'],
            ['nashville', 'Nashville'],
            ['german', 'German'],
            ['latin', 'Latin'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.chip, prefs.notation === id && styles.chipOn]}
            onPress={() => patchPrefs({ notation: id as Notation })}>
            <Text style={[styles.chipText, prefs.notation === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ToggleRow({
  styles,
  label,
  hint,
  on,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  hint?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.toggle} onPress={onPress}>
      <View style={styles.toolCopy}>
        <Text style={styles.presetTitle}>{label}</Text>
        {hint ? <Text style={styles.presetIntent}>{hint}</Text> : null}
      </View>
      <Text style={[styles.toolLabel, on && styles.toolLabelOn]}>{on ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: {
      color: t.text,
      fontSize: t.type.title.fontSize + 2,
      lineHeight: t.type.title.lineHeight + 2,
      fontWeight: t.type.title.fontWeight,
      marginBottom: 8,
      marginTop: 18,
    },
    lede: { color: t.muted, marginBottom: 10, fontSize: t.type.meta.fontSize, lineHeight: t.type.meta.lineHeight + 2 },
    hint: { color: t.muted, marginBottom: 12, fontSize: 13, lineHeight: 18 },
    preset: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 8,
    },
    presetOn: { borderColor: t.accent },
    presetTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    presetTitleOn: { color: t.accent },
    presetIntent: { color: t.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
    rowWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    chipOn: { borderColor: t.accent },
    chipText: { color: t.muted, fontWeight: '700' as const, fontSize: 13 },
    chipTextOn: { color: t.text },
    swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: t.border },
    sizeRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 16,
      gap: 12,
    },
    sizeBtn: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    sizeBtnLabel: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
    sizeValue: { color: t.text, fontWeight: '700' as const, fontSize: 20 },
    toggle: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      padding: 14,
      marginBottom: 8,
      gap: 12,
    },
    toolRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.panel,
      borderRadius: t.radius.md,
      marginBottom: 8,
      paddingRight: 8,
    },
    toolMain: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 14 },
    toolCopy: { flex: 1 },
    toolLabel: { color: t.muted, fontWeight: '800' as const, width: 36 },
    toolLabelOn: { color: t.accent },
    toolMove: { flexDirection: 'row' as const, gap: 4 },
    moveBtn: { paddingHorizontal: 10, paddingVertical: 8 },
    moveText: { color: t.text, fontSize: 16, fontWeight: '700' as const },
    ghost: { paddingVertical: 10, alignItems: 'center' as const, marginBottom: 8 },
    ghostText: { color: t.accent, fontWeight: '700' as const },
    strip: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 8, marginBottom: 8 },
    stripChip: {
      backgroundColor: t.panel,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    stripText: { color: t.text, fontWeight: '600' as const, fontSize: 13 },
  };
}
