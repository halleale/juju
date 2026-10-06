import { StyleSheet, Text, View } from 'react-native';

import { Display, Screen, SectionLabel } from '@/components/ui';
import { SETTLED } from '@/data/mock';
import { beatClose, formatAmerican, formatSigned, settleUnits } from '@/lib/odds';
import { MARKET_LABEL } from '@/lib/picks';
import { byMarketType, formatRecord, summarize } from '@/lib/tracker';
import { colors, fonts } from '@/theme';

const pct = (n: number) => `${formatSigned(n * 100)}%`;
const signColor = (n: number) => (n > 0 ? colors.accent : n < 0 ? colors.caution : colors.secondary);

export default function Tracker() {
  const all = summarize(SETTLED);
  const rows = byMarketType(SETTLED);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Display>Track record</Display>
        <Text style={s.sub}>Every pick the agent alerted, graded against the final result and the closing line.</Text>
      </View>

      <View style={s.grid}>
        <Tile label="Record" value={formatRecord(all)} />
        <Tile label="Units" value={`${formatSigned(all.units, 2)}u`} color={signColor(all.units)} />
        <Tile label="ROI" value={pct(all.roi)} color={signColor(all.roi)} />
        <Tile label="Beat the close" value={`${Math.round(all.clv * 100)}%`} color={all.clv >= 0.5 ? colors.accent : colors.caution} />
      </View>

      <View style={s.note}>
        <Text style={s.noteTitle}>Why closing-line value matters</Text>
        <Text style={s.noteBody}>Results swing with luck over a small sample. Beating the final pre-game price is the steadier sign that the model finds real edges.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>By bet type</SectionLabel>
        <View style={s.panel}>
          {rows.map(({ type, summary }, i) => (
            <View key={type} style={[s.typeRow, i < rows.length - 1 && s.rowBorder]}>
              <Text style={s.typeName}>{MARKET_LABEL[type]}</Text>
              <Text style={s.typeRecord}>{formatRecord(summary)}</Text>
              <Text style={[s.typeUnits, { color: signColor(summary.units) }]}>{formatSigned(summary.units, 2)}u</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel style={{ letterSpacing: 1 }}>Recently settled</SectionLabel>
        {SETTLED.map((p) => {
          const u = settleUnits(p.alertPrice, p.result);
          const clv = beatClose(p.alertPrice, p.closingPrice);
          return (
            <View key={p.id} style={s.settled}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.settledMeta}>
                  {p.sport} · {MARKET_LABEL[p.marketType]} · {p.date}
                </Text>
                <Text style={s.settledLabel}>{p.label}</Text>
                <Text style={s.settledPrices}>
                  Alerted {formatAmerican(p.alertPrice)} · Closed {formatAmerican(p.closingPrice)}
                  {clv ? <Text style={{ color: colors.accent }}> · Beat close</Text> : null}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={[s.result, { color: signColor(u) }]}>{p.result.toUpperCase()}</Text>
                <Text style={[s.settledUnits, { color: signColor(u) }]}>{formatSigned(u, 2)}u</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={s.disclaimer}>Past results do not guarantee future results. 1 unit stake per pick.</Text>
    </Screen>
  );
}

function Tile({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={[s.tileValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 4, padding: 16, borderRadius: 14, backgroundColor: colors.surface },
  tileLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  tileValue: { fontFamily: fonts.mono, fontSize: 24 },
  note: { gap: 6, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  noteTitle: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text },
  noteBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  panel: { borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  typeName: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  typeRecord: { width: 64, fontFamily: fonts.mono, fontSize: 14, color: colors.secondary, textAlign: 'right' },
  typeUnits: { width: 72, fontFamily: fonts.mono, fontSize: 14, textAlign: 'right' },
  settled: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.surface },
  settledMeta: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  settledLabel: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  settledPrices: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  result: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1 },
  settledUnits: { fontFamily: fonts.mono, fontSize: 15 },
  disclaimer: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.faint, textAlign: 'center', paddingVertical: 8 },
});
