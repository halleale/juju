import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BellIcon } from '@/components/icons';
import { PickCard } from '@/components/pick-card';
import { Display, Screen } from '@/components/ui';
import { MARKETS_SCANNED, PICKS } from '@/data/mock';
import { matchPicks } from '@/lib/picks';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';

const FOR_YOU = 'For you';

export default function Picks() {
  const { settings } = useSettings();
  const [filter, setFilter] = useState(FOR_YOU);
  const matched = matchPicks(PICKS, settings);
  const shown = filter === FOR_YOU ? matched : matched.filter((p) => p.sport === filter);
  const labels = [FOR_YOU, ...settings.sports];

  return (
    <Screen
      gap={14}
      header={
        <View style={s.header}>
          <View style={s.titleRow}>
            <View style={s.titleText}>
              <Display>Your edges today</Display>
              <Text style={s.sub}>
                Scanned {MARKETS_SCANNED.toLocaleString('en-US')} markets · {matched.length} fit your interests
              </Text>
            </View>
            <Link href="/alerts" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Alerts" style={s.bell}>
                <BellIcon size={20} color={colors.text} />
                <View style={s.dot} />
              </Pressable>
            </Link>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {labels.map((l) => {
              const on = l === filter;
              return (
                <Pressable key={l} onPress={() => setFilter(l)} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={4} style={[s.filter, on ? s.filterOn : s.filterOff]}>
                  <Text style={[s.filterText, on && s.filterTextOn]}>{l}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      }>
      {shown.map((p) => (
        <PickCard key={p.id} pick={p} matchReason={p.matchReason} />
      ))}
      {shown.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No edges right now</Text>
          <Text style={s.emptyBody}>Your agent keeps scanning. You will get an alert when something fits your interests.</Text>
        </View>
      )}
      <Text style={s.disclaimer}>Edges are model estimates, not guarantees. Set limits in Alerts &amp; controls.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { gap: 14, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  titleText: { flex: 1, gap: 4 },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.caution, borderWidth: 2, borderColor: colors.surface },
  filters: { gap: 8 },
  filter: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  filterOn: { backgroundColor: colors.text },
  filterOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.secondary },
  filterTextOn: { fontFamily: fonts.sansSemi, color: colors.onAccent },
  empty: { gap: 6, padding: 20, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  disclaimer: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.faint, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 12 },
});
