import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { joinOrgByCode } from '@/src/lib/repository';
import { createHostedOrg, syncOrgFromHost } from '@/src/lib/hosted';
import { colors } from '@/src/theme';

export default function GroupsScreen() {
  const { orgs, refresh, setScope } = useLibrary();
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
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
      <Pressable
        style={styles.button}
        onPress={async () => {
          if (!name.trim()) return;
          const created = await createHostedOrg(name.trim());
          await refresh();
          Alert.alert('Group ready', `Invite code ${created.inviteCode}`);
          setName('');
        }}>
        <Text style={styles.buttonText}>Create</Text>
      </Pressable>

      <Text style={styles.label}>Join with invite</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="ABC123"
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
      <Pressable
        style={styles.button}
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
        }}>
        <Text style={styles.buttonText}>Join</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.muted, lineHeight: 22, marginBottom: 16 },
  row: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 18 },
  meta: { color: colors.muted, marginTop: 4 },
  label: { color: colors.muted, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { color: colors.accentText, fontWeight: '700' },
});
