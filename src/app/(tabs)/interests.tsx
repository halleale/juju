import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InterestsForm } from '@/components/interests-form';
import { Display, Screen, SectionLabel } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { colors, fonts } from '@/theme';

export default function Interests() {
  return (
    <Screen gap={28}>
      <View style={{ gap: 8 }}>
        <Display>Interests</Display>
        <Text style={s.lede}>Changes apply to your feed and alerts right away.</Text>
      </View>
      <InterestsForm />
      <Account />
    </Screen>
  );
}

function Account() {
  const { enabled, session, signOut, deleteAccount } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return __DEV__ ? <Text style={s.note}>Demo mode: no Supabase project is configured, so settings reset when the app reloads.</Text> : null;
  }
  if (!session) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <SectionLabel>Account</SectionLabel>
      <View style={s.panel}>
        <View style={[s.row, s.rowBorder]}>
          <Text style={s.label}>Signed in as</Text>
          <Text style={s.value} numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(signOut)} style={[s.row, s.rowBorder]}>
          <Text style={s.label}>Sign out</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => (confirmDelete ? run(deleteAccount) : setConfirmDelete(true))} style={s.row}>
          <Text style={[s.label, { color: colors.caution }]}>{confirmDelete ? 'Tap again to delete for good' : 'Delete account'}</Text>
        </Pressable>
      </View>
      {confirmDelete && <Text style={s.note}>This permanently deletes your account, interests and alert settings.</Text>}
      {error && (
        <Text accessibilityRole="alert" style={[s.note, { color: colors.caution }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  lede: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
  panel: { borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  value: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  note: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
});
