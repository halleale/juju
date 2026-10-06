import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/icons';
import { InterestsForm } from '@/components/interests-form';
import { Display, Footer, PrimaryButton, Screen } from '@/components/ui';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

export default function Onboarding() {
  const { settings } = useSettings();
  const ready = settings.sports.length > 0 && settings.betTypes.length > 0;

  return (
    <Screen
      gap={28}
      footer={
        <Footer>
          <Text style={s.summary}>
            Following {settings.sports.length} sports · {settings.betTypes.length} bet types
          </Text>
          <PrimaryButton label="Build my feed" disabled={!ready} onPress={() => router.push('/onboarding/confirm')} />
        </Footer>
      }>
      <View style={s.top}>
        <View style={s.brand}>
          <Logo />
          <Text style={s.wordmark}>JUJU</Text>
        </View>
        <Text style={s.step}>Step 1 of 2</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Display style={s.title}>What do you like to bet on?</Display>
        <Text style={s.lede}>Your agent scans every market, every day. You only hear about the data-backed edges that match what you pick here.</Text>
      </View>

      <InterestsForm />
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, color: colors.text },
  step: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  title: { fontSize: 38, lineHeight: 39 },
  lede: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
  summary: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
