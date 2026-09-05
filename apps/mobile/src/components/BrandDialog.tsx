import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { useThemedStyles, type AppTheme } from '@/src/theme';

export type BrandDialogAction = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  actions?: BrandDialogAction[];
  onClose: () => void;
};

export function BrandDialog({ visible, title, body, actions, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const buttons = actions?.length ? actions : [{ label: 'OK', onPress: onClose }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          {buttons.map((action) =>
            action.danger ? (
              <Pressable key={action.label} style={styles.danger} onPress={action.onPress}>
                <Text style={styles.dangerText}>{action.label}</Text>
              </Pressable>
            ) : (
              <BrandButton
                key={action.label}
                label={action.label}
                onPress={action.onPress}
              />
            ),
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ActionSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: BrandDialogAction[];
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {options.map((option) => (
            <Pressable
              key={option.label}
              style={styles.sheetRow}
              onPress={() => {
                onClose();
                option.onPress();
              }}>
              <Text style={[styles.sheetLabel, option.danger && styles.dangerText]}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.sheetRow} onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: AppTheme) {
  return {
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(10,10,12,0.45)',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 24,
    },
    card: {
      width: '100%' as const,
      backgroundColor: t.bg,
      borderRadius: t.radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: t.border,
    },
    title: { color: t.text, fontSize: 18, fontWeight: '800' as const, marginBottom: 8 },
    body: { color: t.muted, lineHeight: 22, marginBottom: 16 },
    danger: {
      borderWidth: 1,
      borderColor: t.danger,
      borderRadius: t.radius.md,
      paddingVertical: 14,
      alignItems: 'center' as const,
      marginBottom: 12,
    },
    dangerText: { color: t.danger, fontWeight: '700' as const, fontSize: 16 },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,12,0.45)', justifyContent: 'flex-end' as const },
    sheet: {
      backgroundColor: t.bg,
      borderTopLeftRadius: t.radius.lg,
      borderTopRightRadius: t.radius.lg,
      padding: 16,
      paddingBottom: 28,
      borderWidth: 1,
      borderColor: t.border,
    },
    sheetRow: { paddingVertical: 14 },
    sheetLabel: { color: t.text, fontSize: 16, fontWeight: '700' as const },
    cancel: { color: t.accent, fontSize: 16, fontWeight: '700' as const, textAlign: 'center' as const },
  };
}
