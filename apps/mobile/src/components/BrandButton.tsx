import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Themed';
import { BRAND_GRADIENT, useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function BrandButton({ label, onPress, disabled, busy }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const inactive = disabled && !busy;

  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={styles.wrap}>
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
    </Pressable>
  );
}

function makeStyles(t: AppTheme) {
  return {
    wrap: { marginBottom: 12 },
    gradient: { paddingVertical: 14, alignItems: 'center' as const, borderRadius: t.radius.md },
    busy: { opacity: 0.85 },
    label: { color: t.accentText, fontWeight: '700' as const, fontSize: 16 },
    disabledFill: { backgroundColor: t.panel, borderWidth: 1, borderColor: t.border },
    disabledLabel: { color: t.faint, fontWeight: '700' as const, fontSize: 16 },
  };
}
