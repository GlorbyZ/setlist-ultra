import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import { BrandButton } from '@/src/components/BrandButton';
import { BrandDialog } from '@/src/components/BrandDialog';
import { isHostedConfigured } from '@/src/lib/config';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { deleteOrg, joinOrgByCode, leaveOrg, listOrgMembers, removeOrgMember } from '@/src/lib/repository';
import {
  createHostedOrg,
  deleteHostedOrg,
  hostedSessionEmail,
  leaveHostedOrg,
  listHostedMembers,
  removeHostedMember,
  syncOrgFromHost,
} from '@/src/lib/hosted';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';
import type { OrgRow } from '@setlist-ultra/db';

type Member = { id: string; label: string; role: string; remoteUserId?: string };

export default function GroupsScreen() {
  const { orgs, refresh, setScope } = useLibrary();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hosted = isHostedConfigured();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);

  const loadMembers = async (org: OrgRow) => {
    const local = await listOrgMembers(org.id);
    const rows: Member[] = local.map((row) => ({
      id: row.id,
      label: row.email,
      role: row.role,
    }));
    if (hosted && org.remoteId) {
      try {
        const remote = await listHostedMembers(org.remoteId);
        for (const row of remote) {
          rows.push({
            id: `remote:${row.user_id}`,
            label: row.user_id.slice(0, 8),
            role: row.role,
            remoteUserId: row.user_id,
          });
        }
      } catch {
        // local list still useful
      }
    }
    setMembers(rows);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Groups</Text>
      <Text style={styles.body}>
        {hosted
          ? 'Shared libraries. Invite with a code. Owners can remove members or delete a group.'
          : 'Groups stay on this device until cloud sync is on.'}
      </Text>

      {orgs.map((org) => (
        <View key={org.id} style={styles.row}>
          <Pressable
            onPress={() => {
              void setScope({ libraryKind: 'org', orgId: org.id });
              setOpenId((id) => {
                const next = id === org.id ? null : org.id;
                if (next) void loadMembers(org);
                return next;
              });
            }}>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.meta}>Invite {org.inviteCode}</Text>
          </Pressable>
          {openId === org.id ? (
            <View style={styles.manage}>
              {members.map((member) => (
                <View key={member.id} style={styles.member}>
                  <Text style={styles.memberText}>
                    {member.label} · {member.role}
                  </Text>
                  <Pressable
                    onPress={() =>
                      void (async () => {
                        if (member.remoteUserId && org.remoteId) {
                          await removeHostedMember(org.remoteId, member.remoteUserId);
                        } else {
                          await removeOrgMember(member.id);
                        }
                        await loadMembers(org);
                      })()
                    }>
                    <Text style={styles.danger}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  void (async () => {
                    const email = (await hostedSessionEmail()) ?? 'local';
                    await leaveOrg(org.id, email);
                    if (org.remoteId) {
                      try {
                        await leaveHostedOrg(org.remoteId);
                      } catch {
                        /* local leave still applied */
                      }
                    }
                    await refresh();
                    setOpenId(null);
                  })()
                }>
                <Text style={styles.ghostText}>Leave group</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void (async () => {
                    if (org.remoteId) {
                      try {
                        await deleteHostedOrg(org.remoteId);
                      } catch (error) {
                        setDialog({
                          title: 'Could not delete hosted group',
                          body: error instanceof Error ? error.message : 'Unknown error',
                        });
                        return;
                      }
                    }
                    await deleteOrg(org.id);
                    await refresh();
                    setOpenId(null);
                  })()
                }>
                <Text style={styles.danger}>Delete group</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
          setDialog({ title: 'Group ready', body: `Invite code ${created.inviteCode}` });
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
            setDialog({ title: 'Joined', body: 'Switch libraries from the Songs tab.' });
            setCode('');
          } catch (error) {
            setDialog({ title: 'Join failed', body: error instanceof Error ? error.message : 'Unknown error' });
          }
        }}
      />

      <BrandDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        onClose={() => setDialog(null)}
        actions={[{ label: 'OK', onPress: () => setDialog(null) }]}
      />
    </ScrollView>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },
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
    manage: { marginTop: 12, gap: 8 },
    member: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    memberText: { color: t.text, flex: 1, marginRight: 8 },
    danger: { color: t.danger, fontWeight: '700' as const },
    ghostText: { color: t.accent, fontWeight: '700' as const, paddingVertical: 8 },
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
