import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowUpRightIcon, InfoIcon, TrendLineIcon } from '@/components/icons';
import { Display, Screen, SectionLabel, Switch } from '@/components/ui';
import { ALERTS } from '@/data/mock';
import type { AlertKind } from '@/data/types';
import { useSettings, type AlertToggles } from '@/state/settings';
import { colors, fonts } from '@/theme';

const EDGES = [3, 5, 7];
const LIMITS = [25, 50, 100, 250];

const TOGGLES: { id: keyof AlertToggles; label: string; desc: string }[] = [
  { id: 'edges', label: 'New edges', desc: 'Picks that match your interests' },
  { id: 'moves', label: 'Line moves', desc: 'When a tracked pick gains or loses value' },
  { id: 'injuries', label: 'Injury news', desc: 'When news changes a pick' },
  { id: 'quiet', label: 'Quiet hours', desc: '11 PM to 8 AM' },
];

const KIND_STYLE: Record<AlertKind, { bg: string; fg: string; Icon: typeof InfoIcon }> = {
  new_edge: { bg: colors.accentSoft, fg: colors.accent, Icon: TrendLineIcon },
  line_move: { bg: colors.cautionSoft, fg: colors.caution, Icon: ArrowUpRightIcon },
  pulled: { bg: colors.raised, fg: colors.secondary, Icon: InfoIcon },
};

export default function Alerts() {
  const { settings, update } = useSettings();
  const [limitOpen, setLimitOpen] = useState(false);

  return (
    <Screen>
      <Display>Alerts</Display>

      <View style={{ gap: 10 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>Recent</SectionLabel>
        {ALERTS.map((a) => {
          const k = KIND_STYLE[a.kind];
          return (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              onPress={() => (a.pickId ? router.push({ pathname: '/pick/[id]', params: { id: a.pickId } }) : router.navigate('/picks'))}
              style={({ pressed }) => [s.alert, pressed && { backgroundColor: colors.raised }]}>
              <View style={[s.alertIcon, { backgroundColor: k.bg }]}>
                <k.Icon size={18} color={k.fg} />
              </View>
              <View style={s.alertText}>
                <Text style={s.alertTitle}>{a.title}</Text>
                <Text style={s.alertBody}>{a.body}</Text>
                <Text style={s.alertAgo}>{a.ago}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 12 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>Only alert me when the edge is at least</SectionLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel="Minimum edge" style={s.segment}>
          {EDGES.map((e) => {
            const on = settings.minEdge === e;
            return (
              <Pressable key={e} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => update({ minEdge: e })} style={[s.segBtn, on && { backgroundColor: colors.accent }]}>
                <Text style={[s.segText, on && { color: colors.onAccent }]}>+{e} pts</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.panel}>
        {TOGGLES.map((t) => (
          <View key={t.id} style={[s.row, s.rowBorder]}>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>{t.label}</Text>
              <Text style={s.rowDesc}>{t.desc}</Text>
            </View>
            <Switch label={t.label} value={settings.toggles[t.id]} onChange={(v) => update({ toggles: { ...settings.toggles, [t.id]: v } })} />
          </View>
        ))}
        <View style={s.row}>
          <View style={s.rowText}>
            <Text style={s.rowLabel}>Max alerts per day</Text>
            <Text style={s.rowDesc}>Strongest edges sent first</Text>
          </View>
          <View style={s.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fewer alerts" onPress={() => update({ maxAlertsPerDay: Math.max(1, settings.maxAlertsPerDay - 1) })} style={s.stepBtn}>
              <Text style={s.stepGlyph}>−</Text>
            </Pressable>
            <Text style={s.stepValue}>{settings.maxAlertsPerDay}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="More alerts" onPress={() => update({ maxAlertsPerDay: Math.min(20, settings.maxAlertsPerDay + 1) })} style={s.stepBtn}>
              <Text style={s.stepGlyph}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={s.limits}>
        <Text style={s.limitsTitle}>Play within your limits</Text>
        <Text style={s.limitsBody}>
          {settings.weeklyLimit
            ? `Weekly limit: $${settings.weeklyLimit}. The agent pauses alerts once you hit it.`
            : 'Set a weekly budget and the agent pauses alerts once you hit it.'}
        </Text>
        {limitOpen ? (
          <View style={s.limitOptions}>
            {LIMITS.map((l) => (
              <LimitChip key={l} label={`$${l}`} on={settings.weeklyLimit === l} onPress={() => update({ weeklyLimit: l })} />
            ))}
            <LimitChip label="No limit" on={settings.weeklyLimit === null} onPress={() => update({ weeklyLimit: null })} />
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => setLimitOpen(!limitOpen)} hitSlop={10}>
          <Text style={s.link}>{limitOpen ? 'Done' : settings.weeklyLimit ? 'Change weekly limit' : 'Set a weekly limit'}</Text>
        </Pressable>
        <Text style={s.helpline}>Need to talk to someone? Call or text 1-800-GAMBLER. Free and confidential.</Text>
      </View>
    </Screen>
  );
}

function LimitChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={[s.limitChip, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[s.limitChipText, on && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  alert: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.surface },
  alertIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  alertText: { flex: 1, gap: 3 },
  alertTitle: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text },
  alertBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.muted },
  alertAgo: { fontFamily: fonts.sans, fontSize: 12, color: colors.faint },
  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: colors.surface },
  segBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.mono, fontSize: 15, color: colors.secondary },
  panel: { gap: 2, borderRadius: 14, backgroundColor: colors.surface, paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  rowDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, color: colors.text },
  stepValue: { width: 28, textAlign: 'center', fontFamily: fonts.mono, fontSize: 16, color: colors.text },
  limits: { gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  limitsTitle: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  limitsBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  limitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  limitChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  limitChipText: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  link: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent },
  helpline: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.faint, paddingTop: 4 },
});
