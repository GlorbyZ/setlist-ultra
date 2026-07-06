import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

function TabBarIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 18, color: String(color) }}>{label}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color }) => <TabBarIcon label="♪" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          title: 'Sets',
          tabBarIcon: ({ color }) => <TabBarIcon label="☰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon label="⚙" color={color} />,
        }}
      />
    </Tabs>
  );
}
