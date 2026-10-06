import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar } from '@/components/tab-bar';
import { useAuth } from '@/state/auth';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const { enabled, loading, session } = useAuth();
  const { settings, hydrated } = useSettings();

  // Deep links into the tabs still go through sign-in and onboarding first.
  if (!loading && hydrated && ((enabled && !session) || !settings.onboarded)) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SaveErrorBanner />
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
        <Tabs.Screen name="picks" options={{ title: 'Picks' }} />
        <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
        <Tabs.Screen name="tracker" options={{ title: 'Tracker' }} />
        <Tabs.Screen name="interests" options={{ title: 'Interests' }} />
      </Tabs>
    </View>
  );
}

function SaveErrorBanner() {
  const { saveError, retrySave } = useSettings();
  const insets = useSafeAreaInsets();
  if (!saveError) return null;
  return (
    <View accessibilityRole="alert" style={[s.banner, { paddingTop: insets.top + 8 }]}>
      <Text style={s.text}>Your last change was not saved.</Text>
      <Pressable accessibilityRole="button" onPress={retrySave} hitSlop={10}>
        <Text style={s.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: colors.cautionSoft },
  text: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.text },
  retry: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.caution },
});
