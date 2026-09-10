import { ActivityIndicator, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PressableScale } from '@/src/motion';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

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
  const gradient = theme.gradient;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.wrap, compact && styles.wrapCompact]}
>
      {inactive ? (
        <View style={[styles.face, styles.disabledFill]}>
          <Text style={styles.disabledLabel}>{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.face, busy && styles.busy]}>
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
    wrap: { marginBottom: 12, alignSelf: 'stretch' as const, width: '100%' as const },
    wrapCompact: { marginBottom: 0 },
    face: {
      width: '100%' as const,
      paddingVertical: 14,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 48,
    },
    busy: { opacity: 0.85 },
    label: { color: t.accentText, fontWeight: '700' as const, fontSize: 16 },
    disabledFill: { backgroundColor: t.panel, borderColor: t.border },
    disabledLabel: { color: t.faint, fontWeight: '700' as const, fontSize: 16 },
  };
}
