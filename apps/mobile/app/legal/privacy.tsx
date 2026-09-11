import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Themed';
import { config } from '@/src/lib/config';
import { launchFlags } from '@/src/lib/launchFlags';
import { useTheme, useThemedStyles, type AppTheme } from '@/src/theme';

export default function PrivacyScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const support = config.supportEmail;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        Setlist Ultra stores your songs, setlists, and settings in a local database on this device. You can use the
        core library, editor, and Live charts without creating an account.
      </Text>
      <Text style={styles.body}>
        Files you import stay on the device. Optional Ultimate Guitar search sends the query you type to our catalog
        proxy. Optional cloud sync (when configured and signed in) stores library data with the hosted backend.
        {launchFlags.ai
          ? ' Optional AI uses a key you provide on this device and sends the prompts you choose to that provider.'
          : ''}{' '}
        Camera and photo access are used only when you pick a scan or image.
      </Text>
      <Text style={styles.body}>
        Local backups (.sbpbackup) include songs and sets, not attached audio or PDFs. We do not include ads or
        third-party analytics SDKs in this app. Chart lyrics, credentials, and imported files are not logged by default.
      </Text>
      <Text style={styles.body}>
        To delete a cloud account, sign out here and email {support}. Uninstalling the app removes the local library on
        this device.
      </Text>
      <Pressable onPress={() => void Linking.openURL(`mailto:${support}`)}>
        <Text style={styles.link}>Contact {support}</Text>
      </Pressable>
      {config.privacyPolicyUrl ? (
        <Pressable onPress={() => void Linking.openURL(config.privacyPolicyUrl)}>
          <Text style={styles.link}>Open hosted privacy policy</Text>
        </Pressable>
      ) : null}
      <View style={{ height: 24 }} />
      <Text style={[styles.body, { color: theme.muted }]}>In-app copy. Full policy: docs/privacy.md in the source repo.</Text>
    </ScrollView>
  );
}

function makeStyles(t: AppTheme) {
  return {
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },
    body: {
      color: t.text,
      fontSize: t.type.body.fontSize,
      lineHeight: t.type.body.lineHeight + 4,
      marginBottom: 14,
    },
    link: { color: t.accent, fontWeight: '700' as const, marginBottom: 12, fontSize: 16 },
  };
}
