import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { type ComponentProps, useEffect } from 'react';
import { type ColorValue, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SongsChromeProvider,
  SongsHeaderLeft,
  SongsHeaderRight,
  SongsHeaderTitle,
} from '@/src/providers/SongsChromeProvider';
import { PRESS_SPRING, useReduceMotion } from '@/src/motion';
import { launchFlags } from '@/src/lib/launchFlags';
import { useTheme } from '@/src/theme';

function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  const { theme } = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      scale.value = 1;
      return;
    }
    scale.value = withSpring(focused ? 1.08 : 1, PRESS_SPRING);
  }, [focused, reduce, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ alignItems: 'center', width: 48 }, anim]}>
      <Ionicons name={name} size={size} color={color} />
      {focused ? (
        <LinearGradient
          colors={[...theme.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ marginTop: 4, height: 2, width: 22, borderRadius: 1 }}
        />
      ) : (
        <View style={{ marginTop: 4, height: 2, width: 22 }} />
      )}
    </Animated.View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = Math.max(insets.bottom, 8);

  return (
    <SongsChromeProvider>
      <Tabs
        screenOptions={{
          headerTitleAlign: 'left',
          headerStyle: { backgroundColor: theme.bg, height: 64 + insets.top },
          headerTitleStyle: { color: theme.text, fontWeight: '700', fontSize: 18 },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.muted,
          tabBarActiveBackgroundColor: 'transparent',
          headerShadowVisible: false,
          headerTintColor: theme.text,
          sceneStyle: { backgroundColor: theme.bg },
          tabBarStyle: {
            backgroundColor: theme.bg,
            borderTopColor: theme.border,
            height: 56 + tabPad,
            paddingBottom: tabPad,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Songs',
            headerLeft: () => <SongsHeaderLeft />,
            headerTitle: () => <SongsHeaderTitle />,
            headerTitleAlign: 'left',
            headerLeftContainerStyle: { paddingLeft: 0, justifyContent: 'center' },
            headerRight: () => <SongsHeaderRight />,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="musical-notes" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="sets"
          options={{
            title: 'Sets',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="list" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: 'Assist',
            tabBarLabel: 'Assist',
            href: launchFlags.ai ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="sparkles-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            title: 'Live',
            // LiveChrome owns the centered song header — no app wordmark.
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="play" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="settings-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </SongsChromeProvider>
  );
}
