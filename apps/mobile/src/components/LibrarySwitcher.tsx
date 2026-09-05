import { type Href, Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { useThemedStyles, type AppTheme } from '@/src/theme';

export function LibrarySwitcher() {
  const { scope, orgs, setScope } = useLibrary();
  const styles = useThemedStyles(makeStyles);
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

function makeStyles(t: AppTheme) {
  return {
    row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
    chip: {
      backgroundColor: t.panel,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipOn: { backgroundColor: t.accent, borderColor: t.accent },
    chipText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
  };
}
