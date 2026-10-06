import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackIcon, CheckIcon } from '@/components/icons';
import { Display, Footer, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

/** Step 2: 21+ age gate, terms, and responsible-play info. */
export default function Confirm() {
  const { update } = useSettings();
  const { enabled, session } = useAuth();
  const needsAccount = enabled && !session;
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);

  return (
    <Screen
      footer={
        <Footer>
          <PrimaryButton
            label={needsAccount ? 'Continue' : 'Show my edges'}
            disabled={!age || !terms}
            onPress={() => {
              update({ onboarded: true, ageConfirmed: true });
              if (needsAccount) router.push({ pathname: '/sign-in', params: { from: 'onboarding' } });
              else router.replace('/picks');
            }}
          />
        </Footer>
      }>
      <View style={s.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={s.back}>
          <BackIcon size={20} color={colors.text} />
        </Pressable>
        <Text style={s.step}>Step 2 of {needsAccount ? 3 : 2}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Display style={s.title}>Before we start</Display>
        <Text style={s.lede}>Juju is an information service. You never place bets here, and every edge is a model estimate, not a guarantee.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <Check on={age} onPress={() => setAge(!age)} label="I am 21 or older" />
        <Check on={terms} onPress={() => setTerms(!terms)} label="I agree to the Terms and Privacy Policy" />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Play within your limits</Text>
        <Text style={s.cardBody}>You can set a weekly limit in Alerts at any time. If gambling stops being fun, help is free and confidential: call or text 1-800-GAMBLER.</Text>
      </View>
    </Screen>
  );
}

function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={on} onPress={onPress} style={[s.check, on && { borderColor: colors.accent, backgroundColor: colors.accentTint }]}>
      <View style={[s.box, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}>{on && <CheckIcon size={14} color={colors.onAccent} strokeWidth={3} />}</View>
      <Text style={s.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  title: { fontSize: 38, lineHeight: 39 },
  lede: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
  check: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.dim, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: colors.text },
  card: { gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  cardBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
});
