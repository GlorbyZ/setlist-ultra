import { ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Themed';
import { PressableScale } from '@/src/motion';
import { BRAND_GRADIENT, useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Drop bottom margin for dense action bars. */
  compact?: boolean;
};

export function BrandButton({ label, onPress, disabled, busy, compact }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const inactive = disabled && !busy;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.wrap, compact && styles.wrapCompact]}
      scaleTo={0.97}>
      {inactive ? (
        <View style={[styles.gradient, styles.disabledFill]}>
          <Text style={styles.disabledLabel}>{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[...BRAND_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, busy && styles.busy]}>
          {busy ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
        </LinearGradient>
      )}
    </PressableScale>
  );
}

function makeStyles(t: AppTheme) {
  return {
    wrap: { marginBottom: 12 },
    wrapCompact: { marginBottom: 0 },
    gradient: { paddingVertical: 14, alignItems: 'center' as const, borderRadius: t.radius.md },
    busy: { opacity: 0.85 },
    label: { color: t.accentText, fontWeight: '700' as const, fontSize: 16 },
    disabledFill: { backgroundColor: t.panel, borderWidth: 1, borderColor: t.border },
    disabledLabel: { color: t.faint, fontWeight: '700' as const, fontSize: 16 },
  };
}
