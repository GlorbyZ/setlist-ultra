import { type Href, Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { colors } from '@/src/theme';

export function LibrarySwitcher() {
  const { scope, orgs, setScope } = useLibrary();
  const orgName = orgs.find((o) => o.id === scope.orgId)?.name;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.chip, scope.libraryKind === 'personal' && styles.chipOn]}
        onPress={() => void setScope({ libraryKind: 'personal' })}>
        <Text style={styles.chipText}>Personal</Text>
      </Pressable>
      {orgs.map((org) => (
        <Pressable
          key={org.id}
          style={[styles.chip, scope.libraryKind === 'org' && scope.orgId === org.id && styles.chipOn]}
          onPress={() => void setScope({ libraryKind: 'org', orgId: org.id })}>
          <Text style={styles.chipText}>{org.name}</Text>
        </Pressable>
      ))}
      <Link href={'/groups' as Href} asChild>
        <Pressable style={styles.chip}>
          <Text style={styles.chipText}>{orgName ? 'Groups' : '+ Group'}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
});
