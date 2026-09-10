import { useRef } from 'react';
import { TextInput, View, type TextInputProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { PressableScale } from '@/src/motion';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  returnKeyType?: TextInputProps['returnKeyType'];
  autoFocus?: boolean;
};

/** Themed search field with an X clear control when text is present. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
  inputStyle,
  onSubmitEditing,
  returnKeyType = 'search',
  autoFocus,
}: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const inputRef = useRef<TextInput>(null);

  const clear = () => {
    onChangeText('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        style={[styles.input, inputStyle]}
        returnKeyType={returnKeyType}
        blurOnSubmit
        autoCorrect={false}
        autoCapitalize="none"
        enablesReturnKeyAutomatically
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <PressableScale
          onPress={clear}
          hitSlop={10}
          style={styles.clearBtn}
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={20} color={theme.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    wrap: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: t.inputBg,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingLeft: 14,
      paddingRight: 6,
    },
    input: {
      flex: 1,
      color: t.text,
      paddingVertical: 12,
      paddingRight: 8,
      fontSize: 16,
    },
    clearBtn: {
      paddingHorizontal: 6,
      paddingVertical: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
  };
}
