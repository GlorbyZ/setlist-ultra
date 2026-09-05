import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { type ColorValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/BrandMark';
import { BRAND_GRADIENT, useTheme } from '@/src/theme';

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
  return (
    <View style={{ alignItems: 'center', width: 48 }}>
      <Ionicons name={name} size={size} color={color} />
      {focused ? (
        <LinearGradient
          colors={[...BRAND_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ marginTop: 4, height: 2, width: 22, borderRadius: 1 }}
        />
      ) : (
        <View style={{ marginTop: 4, height: 2, width: 22 }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerLeft: () => <BrandMark height={56} />,
        headerTitle: () => null,
        headerTitleAlign: 'left',
        headerLeftContainerStyle: { paddingLeft: 4, justifyContent: 'center' },
        headerStyle: { backgroundColor: theme.bg, height: 64 + insets.top },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarActiveBackgroundColor: 'transparent',
        headerShadowVisible: false,
        headerTintColor: theme.text,
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
        name="live"
        options={{
          title: 'Live',
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
  );
}
