import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { LineChart } from '@/components/line-chart';
import { Footer, Screen, SectionLabel } from '@/components/ui';
import { PICKS } from '@/data/mock';
import { formatAmerican, formatPct, formatSigned } from '@/lib/odds';
import { booksByPrice, MARKET_LABEL, pickStats, STYLE_LABEL, suggestedUnits } from '@/lib/picks';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/picks');
}

export default function PickDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, toggleIn } = useSettings();
  const pick = PICKS.find((p) => p.id === id);

  if (!pick) {
    return (
      <Screen>
        <BackButton />
        <Text style={s.notFound}>This pick is no longer available. It may have been pulled after news or a line move.</Text>
      </Screen>
    );
  }

  const { price, implied, edge, fair } = pickStats(pick);
  const books = booksByPrice(pick);
  const tracked = settings.tracked.includes(pick.id);
  const alertOn = settings.lineAlerts.includes(pick.id);
  const fmtLine = (v: number) => (pick.line.label === 'Price' ? formatAmerican(v) : String(v));
  const units = suggestedUnits(settings.style);

  return (
    <Screen
      gap={20}
      footer={
        <Footer style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: alertOn }} onPress={() => toggleIn('lineAlerts', pick.id)} style={[s.btn, s.btnGhost]}>
            <Text style={s.btnGhostText}>{alertOn ? 'Alert on' : 'Alert if line moves'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: tracked }} onPress={() => toggleIn('tracked', pick.id)} style={[s.btn, s.btnPrimary]}>
            <Text style={s.btnPrimaryText}>{tracked ? 'Tracking' : 'Track pick'}</Text>
          </Pressable>
        </Footer>
      }>
      <BackButton />

      <View style={{ gap: 6 }}>
        <Text style={s.meta}>
          {pick.sport} · {MARKET_LABEL[pick.marketType]} · {pick.time}
        </Text>
        <Text style={s.game}>
          {pick.away} @ {pick.home}
        </Text>
        <View style={s.titleRow}>
          <Text style={s.title}>{pick.selection}</Text>
          <Text style={s.price}>{formatAmerican(price)}</Text>
        </View>
      </View>

      <View style={[s.card, { gap: 14 }]}>
        <View style={s.cardHead}>
          <SectionLabel style={{ letterSpacing: 1 }}>Model vs market</SectionLabel>
          <Text style={s.edge}>{formatSigned(edge)} pts edge</Text>
        </View>
        <Bar label="Our model" value={pick.modelProb} fill={colors.accent} />
        <Bar label={`Market implied (${formatAmerican(price)})`} value={implied} fill={colors.dim} muted />
        <Text style={s.small}>
          Fair price by our model: <Text style={s.smallMono}>{formatAmerican(fair)}</Text>
        </Text>
      </View>

      <View style={[s.card, { gap: 10 }]}>
        <View style={s.cardHead}>
          <SectionLabel style={{ letterSpacing: 1 }}>{pick.line.label === 'Price' ? 'Price movement' : 'Line movement'}</SectionLabel>
          <Text style={s.opened}>Opened {fmtLine(pick.line.open)}</Text>
        </View>
        <LineChart points={pick.line.points} label={`${pick.line.label} moved from ${fmtLine(pick.line.open)} at open to ${pick.line.nowLabel} now`} />
        <View style={s.cardHead}>
          <Text style={s.axis}>{pick.line.startLabel}</Text>
          <Text style={s.axis}>Now · {pick.line.nowLabel}</Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>Why the agent likes it</SectionLabel>
        {pick.signals.map((sig) => (
          <View key={sig.title} style={s.signal}>
            <View style={[s.signalIcon, { backgroundColor: sig.pro ? colors.accentSoft : colors.cautionSoft }]}>
              {sig.pro ? <PlusIcon size={14} color={colors.accent} /> : <MinusIcon size={14} color={colors.caution} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.signalTitle}>{sig.title}</Text>
              <Text style={s.signalDetail}>{sig.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>Best price right now</SectionLabel>
        {books.map((b, i) => (
          <View key={b.book} style={[s.book, i === 0 && s.bookBest]}>
            <Text style={[s.bookName, i > 0 && { color: colors.secondary }]}>
              [{b.book}]{i === 0 ? <Text style={s.bestTag}>{'  '}Best</Text> : null}
            </Text>
            <Text style={[s.bookPrice, i > 0 && { color: colors.secondary }]}>{formatAmerican(b.price)}</Text>
          </View>
        ))}
      </View>

      <Text style={s.size}>
        Suggested size: <Text style={s.sizeStrong}>{units === 1 ? '1 unit' : `${units} unit`}</Text>, based on your {STYLE_LABEL[settings.style]} style. Model estimates, not guarantees.
      </Text>
    </Screen>
  );
}

function BackButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back to picks" onPress={goBack} style={s.back}>
      <BackIcon size={20} color={colors.text} />
    </Pressable>
  );
}

function Bar({ label, value, fill, muted }: { label: string; value: number; fill: string; muted?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={s.barHead}>
        <Text style={[s.barLabel, muted && { color: colors.secondary }]}>{label}</Text>
        <Text style={[s.barValue, muted && { color: colors.secondary }]}>{formatPct(value)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${value * 100}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  back: { alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
  meta: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  game: { fontFamily: fonts.sans, fontSize: 15, color: colors.secondary },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 44, lineHeight: 46, textTransform: 'uppercase', color: colors.text },
  price: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.raised, fontFamily: fonts.mono, fontSize: 18, color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  edge: { fontFamily: fonts.mono, fontSize: 15, color: colors.accent },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.text },
  barValue: { fontFamily: fonts.mono, fontSize: 13, color: colors.text },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.bg },
  fill: { height: 10, borderRadius: 5 },
  small: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  smallMono: { fontFamily: fonts.mono, color: colors.text },
  opened: { fontFamily: fonts.sans, fontSize: 13, color: colors.secondary },
  axis: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  signal: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  signalIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signalTitle: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text },
  signalDetail: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.muted },
  book: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  bookBest: { borderColor: colors.accent },
  bookName: { fontFamily: fonts.sans, fontSize: 14, color: colors.text },
  bestTag: { fontSize: 12, color: colors.accent },
  bookPrice: { fontFamily: fonts.mono, fontSize: 15, color: colors.text },
  size: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  sizeStrong: { fontFamily: fonts.sansSemi, color: colors.text },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 14 },
  btn: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  btnGhostText: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.onAccent },
});
