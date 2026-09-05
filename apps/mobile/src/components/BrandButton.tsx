import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { brand } from '@/src/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function BrandButton({ label, onPress, disabled, busy }: Props) {
  const inactive = disabled && !busy;

  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={styles.wrap}>
      {inactive ? (
        <View style={[styles.gradient, styles.disabledFill]}>
          <Text style={styles.disabledLabel}>{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[brand.ultraMagenta, brand.ultraViolet, brand.ultraBlue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, busy && styles.busy]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  gradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 8 },
  busy: { opacity: 0.85 },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  disabledFill: { backgroundColor: brand.paperLine },
  disabledLabel: { color: '#8E8E93', fontWeight: '700', fontSize: 16 },
});
