import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Pick } from '@/data/types';
import { formatAmerican, formatPct, formatSigned } from '@/lib/odds';
import { MARKET_LABEL, pickStats } from '@/lib/picks';
import { colors, fonts } from '@/theme';
import { CheckIcon } from './icons';

export function PickCard({ pick, matchReason }: { pick: Pick; matchReason: string }) {
  const { price, implied, edge } = pickStats(pick);
  return (
    <Link href={{ pathname: '/pick/[id]', params: { id: pick.id } }} asChild>
      <Pressable accessibilityRole="link" style={s.card}>
        <View style={s.meta}>
          <Text style={s.metaLeft}>
            {pick.sport} · {MARKET_LABEL[pick.marketType]}
          </Text>
          <Text style={s.metaRight}>{pick.time}</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={s.game}>
            {pick.away} @ {pick.home}
          </Text>
          <View style={s.pickRow}>
            <Text style={s.pick}>{pick.selection}</Text>
            <Text style={s.odds}>{formatAmerican(price)}</Text>
          </View>
        </View>
        <View style={s.stats}>
          <Stat label="Our model" value={formatPct(pick.modelProb)} />
          <Stat label="Market" value={formatPct(implied)} color={colors.secondary} />
          <Stat label="Edge" value={formatSigned(edge)} color={colors.accent} />
        </View>
        <Text style={s.why}>{pick.why}</Text>
        <View style={s.footer}>
          <View style={s.match}>
            <CheckIcon size={14} color={colors.accent} />
            <Text style={s.matchText}>{matchReason}</Text>
          </View>
          <Text style={s.conf}>
            Confidence: <Text style={s.confValue}>{pick.confidence}</Text>
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function Stat({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLeft: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  metaRight: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  game: { fontFamily: fonts.sans, fontSize: 14, color: colors.secondary },
  pickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  pick: { flex: 1, fontFamily: fonts.display, fontSize: 26, lineHeight: 28, textTransform: 'uppercase', color: colors.text },
  odds: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.raised, fontFamily: fonts.mono, fontSize: 15, color: colors.text },
  stats: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.nav },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  statValue: { fontFamily: fonts.mono, fontSize: 17 },
  why: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.secondary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  matchText: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent },
  conf: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  confValue: { fontFamily: fonts.sansSemi, color: colors.text },
});
