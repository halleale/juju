import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

/** Decides where the app opens: onboarding, sign-in, or the feed. */
export default function Index() {
  const { enabled, loading, session } = useAuth();
  const { settings, hydrated, loadFailed, retrySave } = useSettings();

  if (loadFailed) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Could not load your settings</Text>
        <Text style={s.body}>Check your connection and try again.</Text>
        <PrimaryButton label="Try again" onPress={retrySave} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }
  if (loading || !hydrated) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!settings.onboarded) return <Redirect href="/onboarding" />;
  // Finished onboarding but has not created an account yet.
  if (enabled && !session) return <Redirect href={{ pathname: '/sign-in', params: { from: 'onboarding' } }} />;
  return <Redirect href="/picks" />;
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  title: { fontFamily: fonts.sansSemi, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginBottom: 8 },
});
