import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PressableScale } from '@/src/motion';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Optional leading icon (e.g. Google mark). */
  icon?: ReactNode;
  /** Drop bottom margin for dense action bars. */
  compact?: boolean;
};

export function BrandButton({ label, onPress, disabled, busy, icon, compact }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const inactive = disabled && !busy;
  const gradient = theme.gradient;

  const content = (
    <View style={styles.row}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={inactive ? styles.disabledLabel : styles.label}>{label}</Text>
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.wrap, compact && styles.wrapCompact]}
    >
      {inactive ? (
        <View style={[styles.face, styles.disabledFill]}>{content}</View>
      ) : (
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.face, busy && styles.busy]}>
          {busy ? <ActivityIndicator color={theme.accentText} /> : content}
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
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 10,
    },
    icon: { marginTop: 1 },
    busy: { opacity: 0.85 },
    label: { color: t.accentText, fontWeight: '700' as const, fontSize: 16 },
    disabledFill: { backgroundColor: t.panel, borderColor: t.border },
    disabledLabel: { color: t.faint, fontWeight: '700' as const, fontSize: 16 },
  };
}
