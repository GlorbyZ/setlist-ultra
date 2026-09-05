import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function BrandButton({ label, onPress, disabled, busy }: Props) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.wrap, (disabled || busy) && styles.disabled]}>
      <LinearGradient
        colors={[...theme.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, { borderRadius: theme.radius.md }]}>
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  disabled: { opacity: 0.45 },
  gradient: { paddingVertical: 14, alignItems: 'center' },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
