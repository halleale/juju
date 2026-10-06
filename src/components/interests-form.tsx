import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BET_TYPES, SPORTS, TEAMS } from '@/data/mock';
import type { Style } from '@/data/types';
import { useSettings } from '@/state/settings';
import { colors, fonts } from '@/theme';
import { CloseIcon, SearchIcon } from './icons';
import { Chip, SectionLabel } from './ui';

const STYLES: { id: Style; label: string; desc: string }[] = [
  { id: 'conservative', label: 'Conservative', desc: 'Fewer alerts. Only the strongest edges, mostly favorites and totals.' },
  { id: 'balanced', label: 'Balanced', desc: 'Solid edges across sides, totals and props.' },
  { id: 'longshot', label: 'Long shots', desc: 'Plus-money prices and props. Higher variance.' },
];

/** Sports, bet types, teams and style. Shared by onboarding and the Interests tab. */
export function InterestsForm() {
  const { settings, update, toggleIn } = useSettings();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q ? TEAMS.filter((t) => t.name.toLowerCase().includes(q) && !settings.teams.includes(t.name)).slice(0, 5) : [];

  return (
    <>
      <View style={s.group}>
        <SectionLabel>Sports</SectionLabel>
        <View style={s.wrap}>
          {SPORTS.map((sport) => (
            <Chip key={sport} label={sport} on={settings.sports.includes(sport)} onPress={() => toggleIn('sports', sport)} />
          ))}
        </View>
      </View>

      <View style={s.group}>
        <SectionLabel>Bet types</SectionLabel>
        <View style={s.wrap}>
          {BET_TYPES.map((t) => (
            <Chip key={t} label={t} on={settings.betTypes.includes(t)} onPress={() => toggleIn('betTypes', t)} />
          ))}
        </View>
      </View>

      <View style={s.group}>
        <SectionLabel>Teams you follow</SectionLabel>
        <View style={s.search}>
          <SearchIcon size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search teams or players"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Search teams or players"
            style={s.input}
          />
        </View>
        {results.length > 0 && (
          <View style={s.results}>
            {results.map((t) => (
              <Pressable
                key={t.name}
                accessibilityRole="button"
                onPress={() => {
                  toggleIn('teams', t.name);
                  setQuery('');
                }}
                style={({ pressed }) => [s.result, pressed && { backgroundColor: colors.raised }]}>
                <Text style={s.resultName}>{t.name}</Text>
                <Text style={s.resultSport}>{t.sport}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {q.length > 0 && results.length === 0 && <Text style={s.empty}>No matches. Player search arrives with live data.</Text>}
        <View style={s.wrap}>
          {settings.teams.map((team) => (
            <View key={team} style={s.tag}>
              <Text style={s.tagText}>{team}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${team}`} onPress={() => toggleIn('teams', team)} hitSlop={8} style={s.tagX}>
                <CloseIcon size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={s.group}>
        <SectionLabel>Your style</SectionLabel>
        {STYLES.map((r) => {
          const on = settings.style === r.id;
          return (
            <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => update({ style: r.id })} style={[s.style, on ? s.styleOn : s.styleOff]}>
              <View style={[s.radio, on ? s.radioOn : s.radioOff]} />
              <View style={s.styleText}>
                <Text style={s.styleLabel}>{r.label}</Text>
                <Text style={[s.styleDesc, on && { color: '#B4BCC8' }]}>{r.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  group: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  input: { flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.sans, fontSize: 15, height: '100%', outlineStyle: 'none' } as never,
  results: { borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  result: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultName: { fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  resultSport: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 12, paddingRight: 6, borderRadius: 16, backgroundColor: colors.raised },
  tagText: { fontFamily: fonts.sans, fontSize: 14, color: colors.text },
  tagX: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  style: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5 },
  styleOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  styleOff: { borderColor: colors.border, backgroundColor: colors.surface },
  radio: { width: 20, height: 20, borderRadius: 10 },
  radioOn: { borderWidth: 6, borderColor: colors.accent },
  radioOff: { borderWidth: 2, borderColor: colors.dim },
  styleText: { flex: 1, gap: 2 },
  styleLabel: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text },
  styleDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
});
