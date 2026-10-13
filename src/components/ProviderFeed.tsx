import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { League } from '../domain';
import { american } from '../domain';

type Quote = { eventId: string; home: string; away: string; market: string; selection: string; line: number | null; odds: number; book: string; providerUpdatedAt: string | null; status: string };
type Feed = { quotes: Quote[]; message: string; status: string; recommendationsEnabled: boolean };
export default function ProviderFeed({ league }: { league: League }) {
  const base = process.env.EXPO_PUBLIC_RESEARCH_API_URL;
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    let mounted = true;
    const timer = setTimeout(() => controller.abort(), 10000);
    async function load() {
      setFeed(null); setError(''); setLoading(true);
      try {
        const response = await fetch(`${base!.replace(/\/$/, '')}/v1/slate?league=${league}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        if (!Array.isArray(data.quotes) || data.recommendationsEnabled !== false) throw new Error('Unexpected response');
        if (mounted) setFeed(data);
      } catch { if (mounted) setError('Provider research is unavailable. Demo analysis below remains fictional.'); }
      finally { clearTimeout(timer); if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; controller.abort(); clearTimeout(timer); };
  }, [base, league, revision]);
  return <View style={s.panel}>
    <Text style={s.title}>Provider research · {league === 'nfl' ? 'NFL' : 'NCAAF'}</Text>
    {!base && <Text style={s.body}>The Odds API for prices · {league === 'nfl' ? 'nflverse for initial schedules/results' : 'CollegeFootballData for research'}. Live research is not connected on this device.</Text>}
    {loading && <Text style={s.body}>Reading the shared research snapshot…</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
    {feed && <><Text style={s.body}>{feed.message}</Text>{feed.quotes.length === 0 && <Text style={s.body}>No provider quotes available.</Text>}{feed.quotes.slice(0, 12).map((quote, index) => <View key={`${quote.eventId}-${index}`} style={s.quote}><Text style={s.body}>{quote.away} at {quote.home}</Text><Text style={s.body}>{quote.selection} {quote.line ?? ''} · {american(quote.odds)} · {quote.book}</Text><Text style={s.small}>{quote.market} · {quote.status.toUpperCase()} · provider update {quote.providerUpdatedAt || 'unknown'}</Text></View>)}{feed.quotes.length > 12 && <Text style={s.small}>Showing the first 12 quotes in this research preview.</Text>}</>}
    {base && <Pressable accessibilityRole="button" disabled={loading} onPress={() => setRevision(v => v + 1)} style={s.button}><Text style={s.link}>Reload shared snapshot</Text></Pressable>}
    <Text style={s.small}>Research only. No model probabilities or bet recommendations. Reloading this panel never spends provider quota.</Text>
  </View>;
}
const s = StyleSheet.create({ panel: { padding: 20, gap: 12, borderRadius: 20, backgroundColor: '#182b2b', borderWidth: 1, borderColor: '#2d4944' }, title: { color: '#b5ead4', fontSize: 17, fontWeight: '600' }, body: { color: '#bac9d5', fontSize: 14, lineHeight: 22 }, small: { color: '#96a9ba', fontSize: 12, lineHeight: 19 }, quote: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderColor: '#2d4944' }, button: { paddingVertical: 12, minHeight: 44 }, link: { color: '#a3f6ca', fontSize: 14 } });
