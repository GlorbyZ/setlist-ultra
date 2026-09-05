import { type Href, Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/Themed';
import { isHostedConfigured } from '@/src/lib/config';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { BRAND_GRADIENT, useThemedStyles, type AppTheme } from '@/src/theme';

export function LibrarySwitcher() {
  const { scope, orgs, setScope } = useLibrary();
  const styles = useThemedStyles(makeStyles);
  const orgName = orgs.find((o) => o.id === scope.orgId)?.name;
  const hosted = isHostedConfigured();

  return (
    <View style={styles.row}>
      <Chip
        label="Personal"
        on={scope.libraryKind === 'personal'}
        onPress={() => void setScope({ libraryKind: 'personal' })}
        styles={styles}
      />
      {orgs.map((org) => (
        <Chip
          key={org.id}
          label={org.name}
          on={scope.libraryKind === 'org' && scope.orgId === org.id}
          onPress={() => void setScope({ libraryKind: 'org', orgId: org.id })}
          styles={styles}
        />
      ))}
      <Link href={'/groups' as Href} asChild>
        <Pressable style={styles.chip}>
          <Text style={styles.chipText}>{hosted ? (orgName ? 'Groups' : '+ Group') : 'Groups'}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function Chip({
  label,
  on,
  onPress,
  styles,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (on) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient colors={[...BRAND_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipOn}>
          <Text style={styles.chipOnText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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
    chipOn: {
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipText: { color: t.text, fontWeight: '700' as const, fontSize: 12 },
    chipOnText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 12 },
  };
}
