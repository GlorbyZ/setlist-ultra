import { Text as DefaultText, View as DefaultView, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/src/theme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: 'text' | 'background',
) {
  const { theme } = useTheme();
  const isLight = theme.id === 'ultra-light';
  const colorFromProps = isLight ? props.light : props.dark;
  if (colorFromProps) return colorFromProps;
  return colorName === 'background' ? theme.bg : theme.text;
}

function styleSetsColor(style: StyleProp<TextStyle> | undefined) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return flat?.color != null;
}

function styleSetsBackground(style: StyleProp<ViewStyle> | undefined) {
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  return flat?.backgroundColor != null;
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  // Prefer explicit style colors (titles, BrandButton labels) over the default theme text.
  return <DefaultText style={[styleSetsColor(style) ? null : { color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  return (
    <DefaultView
      style={[styleSetsBackground(style) ? null : { backgroundColor }, style]}
      {...otherProps}
    />
  );
}
