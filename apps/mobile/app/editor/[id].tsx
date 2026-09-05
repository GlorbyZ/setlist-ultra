import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { KEY_OPTIONS } from '@setlist-ultra/core';
import { copySongToLibrary, getLibraryScope, getSong, updateSong } from '@/src/lib/repository';
import { printSong } from '@/src/lib/print';
import { useLibrary } from '@/src/providers/LibraryProvider';
import { colors } from '@/src/theme';
import type { SongRow } from '@setlist-ultra/db';

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh, orgs } = useLibrary();
  const [song, setSong] = useState<SongRow | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [chordpro, setChordpro] = useState('');
  const [key, setKey] = useState('A');
  const [capo, setCapo] = useState('0');
  const [duration, setDuration] = useState('90');
  const [tempo, setTempo] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const row = await getSong(id);
      if (!row) return;
      setSong(row);
      setTitle(row.title);
      setArtist(row.artist);
      setChordpro(row.chordpro || '');
      setKey(row.originalKey || 'A');
      setCapo(String(row.capo ?? 0));
      setDuration(String(row.duration2 ?? row.durationSeconds ?? 90));
      setTempo(row.tempo != null ? String(row.tempo) : '');
      setNotes(row.notesText ?? '');
      setUrl(row.webUrl ?? row.sourceUrl ?? '');
      setTags(row.tags ?? '');
    })();
  }, [id]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateSong(id, {
        title,
        artist,
        originalKey: key,
        capo: Number.parseInt(capo, 10) || 0,
        durationSeconds: Number.parseInt(duration, 10) || 90,
        duration2: Number.parseInt(duration, 10) || 90,
        tempo: tempo ? Number.parseInt(tempo, 10) : undefined,
        notesText: notes,
        webUrl: url,
        tags,
        chordpro,
      });
      setDirty(false);
      await refresh();
      const row = await getSong(id);
      setSong(row);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (!song) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.bar}>
        <Text style={styles.hint}>{dirty ? 'Unsaved changes' : 'Saved'}</Text>
        <Pressable style={styles.save} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={() => song && void printSong(song)}>
          <Text style={styles.ghostText}>Print</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={(v) => { setTitle(v); setDirty(true); }} />
        <Text style={styles.label}>Artist</Text>
        <TextInput style={styles.input} value={artist} onChangeText={(v) => { setArtist(v); setDirty(true); }} />
        <Text style={styles.label}>Key (0 = A)</Text>
        <ScrollView horizontal contentContainerStyle={styles.keys}>
          {KEY_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={[styles.keyChip, key === option && styles.keyOn]}
              onPress={() => {
                setKey(option);
                setDirty(true);
              }}>
              <Text style={styles.keyText}>{option}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Capo</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={capo} onChangeText={(v) => { setCapo(v); setDirty(true); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Duration (sec)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={duration} onChangeText={(v) => { setDuration(v); setDirty(true); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tempo</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={tempo} onChangeText={(v) => { setTempo(v); setDirty(true); }} />
          </View>
        </View>
        <Text style={styles.label}>URL</Text>
        <TextInput style={styles.input} value={url} autoCapitalize="none" onChangeText={(v) => { setUrl(v); setDirty(true); }} />
        <Text style={styles.label}>Tags / notes</Text>
        <TextInput style={styles.input} value={tags} onChangeText={(v) => { setTags(v); setDirty(true); }} />
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={(v) => { setNotes(v); setDirty(true); }}
          placeholder="Stage notes"
          placeholderTextColor={colors.faint}
        />
        <Text style={styles.label}>ChordPro</Text>
        <TextInput
          style={[styles.input, styles.editor]}
          value={chordpro}
          onChangeText={(v) => { setChordpro(v); setDirty(true); }}
          multiline
          textAlignVertical="top"
        />
        {orgs.length ? (
          <Pressable
            style={styles.ghost}
            onPress={() =>
              void (async () => {
                const scope = await getLibraryScope();
                const target = orgs.find((o) => o.id !== scope.orgId) ?? orgs[0];
                await copySongToLibrary(song.id, { libraryKind: 'org', orgId: target.id });
                Alert.alert('Copied', `Added to ${target.name}`);
              })()
            }>
            <Text style={styles.ghostText}>Copy to group library</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.ghost} onPress={() => router.push(`/song/${song.id}`)}>
          <Text style={styles.ghostText}>Open live view</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  hint: { color: colors.muted, flex: 1, fontWeight: '600' },
  save: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  saveText: { color: colors.accentText, fontWeight: '800' },
  ghost: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostText: { color: colors.accent, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  label: { color: colors.muted, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.border,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  editor: { minHeight: 280, fontFamily: 'SpaceMono', fontSize: 14 },
  metaRow: { flexDirection: 'row', gap: 8 },
  keys: { gap: 8, paddingBottom: 12 },
  keyChip: { backgroundColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  keyOn: { backgroundColor: colors.accent },
  keyText: { color: colors.text, fontWeight: '700' },
});
