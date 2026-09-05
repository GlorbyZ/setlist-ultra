import { Image, StyleSheet } from 'react-native';

import { useTheme } from '@/src/theme';

const logoMain = require('../../assets/brand/logo-wordmark.png');
const logoWhite = require('../../assets/brand/logo-wordmark-white.png');

const WORDMARK_ASPECT = 993 / 415;

export function BrandMark({ height = 32 }: { height?: number }) {
  const { theme } = useTheme();
  const light = theme.id === 'ultra-light';
  return (
    <Image
      source={light ? logoMain : logoWhite}
      resizeMode="contain"
      style={[styles.mark, { height, width: Math.round(height * WORDMARK_ASPECT) }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: 0 },
});
