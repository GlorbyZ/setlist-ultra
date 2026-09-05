import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
};

export function SwipePager({ children, onPrev, onNext, enabled = true }: Props) {
  const pan = Gesture.Pan()
    .enabled(enabled && Boolean(onPrev || onNext))
    .activeOffsetX([-48, 48])
    .failOffsetY([-28, 28])
    .onEnd((event) => {
      if (event.translationX < -56 && onNext) runOnJS(onNext)();
      if (event.translationX > 56 && onPrev) runOnJS(onPrev)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
