import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { colors } from '@/src/theme';

function TabBarIcon({ label, color }: { label: string; color: string | { toString(): string } }) {
  return <Text style={{ fontSize: 18, color: String(color) }}>{label}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        headerStyle: { backgroundColor: colors.panel },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
        tabBarInactiveTintColor: Colors[colorScheme ?? 'dark'].tabIconDefault,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color }) => <TabBarIcon label="♪" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          title: 'Sets',
          tabBarIcon: ({ color }) => <TabBarIcon label="☰" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color }) => <TabBarIcon label="▶" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon label="⚙" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
