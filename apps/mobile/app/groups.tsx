import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { joinOrgByCode } from '@/src/lib/repository';
import { createHostedOrg, syncOrgFromHost } from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function GroupsScreen() {
  const { orgs, refresh, setScope } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Groups</Text>
      <Text style={styles.body}>
        Shared libraries without Songbook Pro Groups. Invite with a code. Web is a first-class editor — use Save on each
        chart. Copy songs between Personal and a group from the editor.
      </Text>

      {orgs.map((org) => (
        <Pressable
          key={org.id}
          style={styles.row}
          onPress={() => void setScope({ libraryKind: 'org', orgId: org.id })}>
          <Text style={styles.title}>{org.name}</Text>
          <Text style={styles.meta}>Invite {org.inviteCode}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Create group</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Band or church name"
        placeholderTextColor={theme.faint}
        style={styles.input}
      />
      <BrandButton
        label="Create"
        onPress={async () => {
          if (!name.trim()) return;
          const created = await createHostedOrg(name.trim());
          await refresh();
          Alert.alert('Group ready', `Invite code ${created.inviteCode}`);
          setName('');
        }}
      />

      <Text style={styles.label}>Join with invite</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="ABC123"
        placeholderTextColor={theme.faint}
        style={styles.input}
      />
      <BrandButton
        label="Join"
        onPress={async () => {
          try {
            try {
              await syncOrgFromHost(code.trim());
            } catch {
              await joinOrgByCode(code.trim());
            }
            await refresh();
            Alert.alert('Joined', 'Switch libraries from the Songs tab.');
            setCode('');
          } catch (error) {
            Alert.alert('Join failed', error instanceof Error ? error.message : 'Unknown error');
          }
        }}
      />
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg, padding: 20 },
    heading: { color: t.text, fontSize: 24, fontWeight: '800' as const, marginBottom: 8 },
    body: { color: t.muted, lineHeight: 22, marginBottom: 16 },
    row: {
      backgroundColor: t.panel,
      borderRadius: t.radius.lg,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    title: { color: t.text, fontWeight: '700' as const, fontSize: 18 },
    meta: { color: t.muted, marginTop: 4 },
    label: { color: t.muted, fontWeight: '600' as const, marginTop: 12, marginBottom: 8 },
    input: {
      backgroundColor: t.inputBg,
      color: t.text,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
    },
  };
}
