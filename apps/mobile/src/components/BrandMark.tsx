import { Image, StyleSheet } from 'react-native';

import { useTheme } from '@/src/theme';

const logoMain = require('../../assets/brand/logo-main.png');
const logoWhite = require('../../assets/brand/logo-white.png');

export function BrandMark({ height = 32 }: { height?: number }) {
  const { theme } = useTheme();
  const light = theme.id === 'ultra-light';
  return (
    <Image
      source={light ? logoMain : logoWhite}
      resizeMode="contain"
      style={[styles.mark, { height, width: height * 4.2 }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: 2 },
});
