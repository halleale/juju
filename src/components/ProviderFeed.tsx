import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { League } from '../domain';
import { american } from '../domain';
import { parseProviderFeed, providerQuoteStatus } from '../providerFeed';
import type { ProviderFeedData } from '../providerFeed';

const PAGE_SIZE = 6;
export default function ProviderFeed({ league }: { league: League }) {
  const base = process.env.EXPO_PUBLIC_RESEARCH_API_URL;
  const [feed, setFeed] = useState<ProviderFeedData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { setNow(Date.now()); setRevision(v => v + 1); }
    });
    return () => { clearInterval(tick); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    let mounted = true;
    const timer = setTimeout(() => controller.abort(), 10000);
    async function load() {
      setError(''); setLoading(true);
      try {
        const response = await fetch(`${base!.replace(/\/$/, '')}/v1/slate?league=${league}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = parseProviderFeed(await response.json());
        if (mounted) {
          setFeed(data); setLoadedAt(Date.now()); setNow(Date.now());
          setSelectedId(previous => data.events.some(event => event.eventId === previous) ? previous : (data.events.find(event => Date.parse(event.kickoff) > Date.now()) || data.events[0])?.eventId || '');
          setPage(previous => Math.min(previous, Math.max(0, Math.ceil(data.events.length / PAGE_SIZE) - 1)));
        }
      } catch { if (mounted) { setFeed(null); setError('Provider research is unavailable. Demo analysis below remains fictional.'); } }
      finally { clearTimeout(timer); if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; controller.abort(); clearTimeout(timer); };
  }, [base, league, revision]);
  const event = feed?.events.find(value => value.eventId === selectedId);
  const quotes = feed?.quotes.filter(quote => quote.eventId === selectedId) || [];
  // Server time plus elapsed device time prevents a slow device clock reviving stale quotes.
  const effectiveNow = Math.max(now, Date.parse(feed?.asOf || '') + now - loadedAt);
  return <View style={s.panel}>
    <Text style={s.title}>Provider research · {league === 'nfl' ? 'NFL' : 'NCAAF'}</Text>
    {!base && <Text style={s.body}>The Odds API for prices · {league === 'nfl' ? 'nflverse for initial schedules/results' : 'CollegeFootballData for research'}. Live research is not connected on this device.</Text>}
    {loading && <Text style={s.body}>Reading the shared research snapshot…</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
    {feed && <>
      <Text style={s.body}>{feed.message}</Text>
      {feed.quotes.length === 0 && <Text style={s.body}>No provider quotes available.</Text>}
      {feed.events.length > 0 && <>
        <Text style={s.small}>{feed.events.length} provider games · select a game to inspect every quote.</Text>
        {feed.events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(game => <Pressable key={game.eventId} accessibilityRole="button" accessibilityState={{ selected: game.eventId === selectedId }} onPress={() => setSelectedId(game.eventId)} style={[s.game, game.eventId === selectedId && s.selected]}>
          <Text style={s.body}>{game.away} at {game.home}</Text>
          <Text style={s.small}>{new Date(game.kickoff).toLocaleString()} · local time</Text>
        </Pressable>)}
        <View style={s.row}>
          <Pressable accessibilityRole="button" disabled={page === 0} onPress={() => setPage(v => v - 1)} style={s.button}><Text style={[s.link, page === 0 && s.disabled]}>Previous games</Text></Pressable>
          <Text style={s.small}>Page {page + 1} / {Math.ceil(feed.events.length / PAGE_SIZE)}</Text>
          <Pressable accessibilityRole="button" disabled={(page + 1) * PAGE_SIZE >= feed.events.length} onPress={() => setPage(v => v + 1)} style={s.button}><Text style={[s.link, (page + 1) * PAGE_SIZE >= feed.events.length && s.disabled]}>Next games</Text></Pressable>
        </View>
      </>}
      {event && <View style={s.quote}>
        <Text style={s.title}>{event.away} at {event.home}</Text>
        <Text style={s.small}>Odds event {event.eventId} · kickoff {event.kickoff}</Text>
        {event.schedule.status === 'matched' ? <>
          <Text style={s.body}>Schedule confirmed · {event.schedule.provider} · week {event.schedule.week}{event.schedule.venue ? ` · ${event.schedule.venue}` : ''}</Text>
          <Text style={s.small}>Schedule source ID {event.schedule.sourceEventId} · source kickoff {event.schedule.scheduledKickoff}{'\n'}Schedule collected {event.schedule.ingestedAt}</Text>
          {league === 'ncaaf' && <Text style={s.small}>{event.schedule.fbsMatchup ? 'FBS matchup.' : 'FBS classification not confirmed for both teams.'} {event.schedule.advancedStatsStatus === 'available_postgame_only' ? 'Postgame statistics available; not verified pregame evidence.' : 'Advanced game statistics unavailable for this game.'}</Text>}
        </> : <Text style={s.body}>Schedule {event.schedule.status}. No unverified research is attached.</Text>}
        <Text style={s.small}>Schedule collection time does not establish when historical facts became available.</Text>
      </View>}
      {quotes.map((quote, index) => <View key={`${quote.eventId}-${index}`} style={s.quote}>
        <Text style={s.body}>{quote.selection} {quote.line ?? ''} · {american(quote.odds)} · {quote.book}</Text>
        <Text style={s.small}>{quote.market} · {providerQuoteStatus(quote, effectiveNow).toUpperCase().replaceAll('_', ' ')} · {quote.provider}</Text>
        <Text style={s.small}>Provider update {quote.providerUpdatedAt || 'unknown'} ({quote.timestampScope} timestamp){'\n'}Collected {quote.ingestedAt}</Text>
      </View>)}
    </>}
    {base && <Pressable accessibilityRole="button" disabled={loading} onPress={() => setRevision(v => v + 1)} style={s.button}><Text style={s.link}>Reload shared snapshot</Text></Pressable>}
    <Text style={s.small}>Research only. No model probabilities or bet recommendations. Reloading this panel never spends provider quota. Stored quotes become stale after five minutes, or two minutes in the final hour, and expire at kickoff.</Text>
  </View>;
}
const s = StyleSheet.create({ panel: { padding: 20, gap: 12, borderRadius: 20, backgroundColor: '#182b2b', borderWidth: 1, borderColor: '#2d4944' }, title: { color: '#b5ead4', fontSize: 17, fontWeight: '600' }, body: { color: '#bac9d5', fontSize: 14, lineHeight: 22 }, small: { color: '#96a9ba', fontSize: 12, lineHeight: 19 }, quote: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderColor: '#2d4944' }, button: { paddingVertical: 12, minHeight: 44 }, link: { color: '#a3f6ca', fontSize: 14 }, game: { padding: 12, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#2d4944' }, selected: { borderColor: '#a3f6ca' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }, disabled: { opacity: 0.4 } });
