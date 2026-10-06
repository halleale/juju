import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackIcon } from '@/components/icons';
import { Display, Footer, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { colors, fonts } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function message(e: unknown) {
  const text = e instanceof Error ? e.message : '';
  if (/expired|invalid/i.test(text)) return 'That code is wrong or has expired. Check the latest email or send a new code.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a minute and try again.';
  return text || 'Something went wrong. Try again.';
}

export default function SignIn() {
  const { enabled, session, sendCode, verifyCode } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = from === 'onboarding';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || session) return <Redirect href="/" />;

  const emailOk = EMAIL_RE.test(email.trim());
  const codeOk = /^\d{6,10}$/.test(code);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const address = email.trim().toLowerCase();
      await sendCode(address);
      setSentTo(address);
      setCode('');
    });

  // On success the auth listener updates the session and the index route takes over.
  const verify = () => run(() => verifyCode(sentTo!, code));

  return (
    <Screen
      footer={
        <Footer>
          {busy ? (
            <View style={s.busy}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : sentTo ? (
            <PrimaryButton label="Verify and continue" disabled={!codeOk} onPress={verify} />
          ) : (
            <PrimaryButton label="Email me a code" disabled={!emailOk} onPress={send} />
          )}
        </Footer>
      }>
      <View style={s.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (sentTo ? setSentTo(null) : router.canGoBack() ? router.back() : router.replace('/onboarding'))}
          style={s.back}>
          <BackIcon size={20} color={colors.text} />
        </Pressable>
        {fromOnboarding && <Text style={s.step}>Step 3 of 3</Text>}
      </View>

      <View style={{ gap: 8 }}>
        <Display style={s.title}>{sentTo ? 'Check your email' : fromOnboarding ? 'Save your feed' : 'Sign in'}</Display>
        <Text style={s.lede}>
          {sentTo
            ? `We sent a code to ${sentTo}. Enter it below.`
            : fromOnboarding
              ? 'Create an account so your interests and alert settings follow you to any device. No password needed.'
              : 'Enter your email and we will send you a one-time code. No password needed.'}
        </Text>
      </View>

      {sentTo ? (
        <View style={{ gap: 12 }}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="Code"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            accessibilityLabel="Code from email"
            onSubmitEditing={() => codeOk && !busy && verify()}
            style={[s.input, s.codeInput]}
          />
          <Pressable accessibilityRole="button" onPress={send} disabled={busy} hitSlop={10} style={{ alignSelf: 'flex-start' }}>
            <Text style={s.link}>Send a new code</Text>
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.faint}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Email"
          onSubmitEditing={() => emailOk && !busy && send()}
          style={s.input}
        />
      )}

      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  title: { fontSize: 38, lineHeight: 39 },
  lede: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
  input: { height: 52, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, color: colors.text, fontFamily: fonts.sans, fontSize: 16 },
  codeInput: { fontFamily: fonts.mono, fontSize: 22, letterSpacing: 6 },
  link: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent },
  error: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.caution },
  busy: { height: 54, alignItems: 'center', justifyContent: 'center' },
});
