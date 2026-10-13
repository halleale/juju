import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { picks } from './demo';
import { BOOKS, agentReply, american, price, validateBet } from './domain';
import type { ManualBet, Pick } from './domain';

type Tab = 'Picks' | 'Games' | 'My Picks' | 'Results';
type Preferences = { onboarded: boolean; books: string[] };
const KEY = 'juju-demo-v1';
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const label = (p: Pick) => `${p.selection}${p.line === null ? '' : ` ${p.line > 0 && p.market === 'Spread' ? '+' : ''}${p.line}`}`;
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: .45 }]}><Text style={[s.buttonText, secondary && { color: '#dbe6ed' }]}>{title}</Text></Pressable>;
}
function Chip({ text, selected, onPress }: { text: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && { backgroundColor: '#224638', borderColor: '#7ce5b3' }]}><Text style={[s.small, selected && { color: '#a3f6ca' }]}>{text}</Text></Pressable>;
}
function Field({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <View style={{ gap: 8 }}><Text style={s.small}>{title}</Text><TextInput accessibilityLabel={title} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#6f8191" style={s.input} /></View>;
}
export default function App() {
  const params = useLocalSearchParams<{ tab?: string; pick?: string; settings?: string }>();
  const tab: Tab = (['Picks', 'Games', 'My Picks', 'Results'] as string[]).includes(params.tab || '') ? params.tab as Tab : 'Picks';
  function setTab(next: Tab) { router.setParams({ tab: next }); }
  const [preferences, setPreferences] = useState<Preferences>({ onboarded: false, books: [...BOOKS] });
  const [saved, setSaved] = useState<string[]>([]);
  const [bets, setBets] = useState<ManualBet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const detail = picks.find(p => p.id === params.pick) || null;
  function setDetail(next: Pick | null) { router.setParams({ pick: next?.id || '' }); }
  const settings = params.settings === 'true';
  function setSettings(next: boolean) { router.setParams({ settings: next ? 'true' : '' }); }
  const [recording, setRecording] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [book, setBook] = useState(BOOKS[0]);
  const [odds, setOdds] = useState('');
  const [line, setLine] = useState('');
  const [stake, setStake] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.saved) || !Array.isArray(data.bets) || !data.preferences || !Array.isArray(data.preferences.books)) throw new Error('Invalid local data');
      setSaved(data.saved.filter((id: unknown) => typeof id === 'string' && picks.some(p => p.id === id)));
      setBets(data.bets.filter((b: ManualBet) => b && picks.some(p => p.id === b.pickId) && typeof b.odds === 'number' && typeof b.id === 'string'));
      setPreferences({ onboarded: data.preferences.onboarded === true, books: data.preferences.books.filter((b: string) => BOOKS.includes(b)) });
    }).catch(() => setStorageError('Could not restore local data. Demo changes will stay in this session.')).finally(() => setLoaded(true));
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (loaded && !storageError) AsyncStorage.setItem(KEY, JSON.stringify({ preferences, saved, bets })).catch(() => setStorageError('Could not save changes on this device.'));
  }, [loaded, preferences, saved, bets, storageError]);
  function open(p: Pick) { setDetail(p); setRecording(false); setQuestion(''); setAnswer(''); setFormError(''); }
  function status(p: Pick) { return p.status === 'active' && Date.parse(p.kickoff) <= now ? 'Expired' : p.status === 'active' ? 'Sample pick' : p.status.charAt(0).toUpperCase() + p.status.slice(1); }
  function toggleBook(b: string) { setPreferences(prev => ({ ...prev, books: prev.books.includes(b) ? prev.books.filter(v => v !== b) : [...prev.books, b] })); }
  function startRecord() { if (!detail) return; setBook(detail.book); setOdds(String(detail.odds)); setLine(detail.line === null ? '' : String(detail.line)); setStake(''); setFormError(''); setRecording(true); }
  function record() {
    if (!detail) return;
    try {
      const fields = validateBet({ book, odds, line, stake }, detail.market);
      setBets(prev => [...prev, { ...fields, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, pickId: detail.id, recordedAt: new Date().toISOString() }]);
      setRecording(false); setDetail(null); setTab('My Picks');
    } catch (err) { setFormError((err as Error).message); }
  }
  const visible = picks.filter(p => p.status === 'active' && Date.parse(p.kickoff) > now && preferences.books.includes(p.book));
  function card(p: Pick) {
    return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`View ${label(p)}`} onPress={() => open(p)} style={s.card}>
      <View style={s.row}><Text style={s.eyebrow}>{p.market.toUpperCase()}</Text><Text style={[s.small, { color: p.status === 'watching' ? '#f8c784' : '#89dbb3' }]}>{status(p)}</Text></View>
      <Text style={s.match}>{p.away} <Text style={s.muted}>at</Text> {p.home}</Text>
      <Text style={s.small}>{new Date(p.kickoff).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · local time</Text>
      <View style={[s.row, { marginTop: 16 }]}><Text style={s.selection}>{label(p)}</Text><Text style={s.quote}>{american(p.odds)}</Text></View>
      <View style={s.row}><Text style={s.small}>{p.book} · fictional quote</Text><Text style={s.small}>View analysis →</Text></View>
    </Pressable>;
  }
  if (!loaded) return <SafeAreaView style={s.shell}><ActivityIndicator accessibilityLabel="Loading demo data" color="#a3f6ca" /></SafeAreaView>;
  if (!preferences.onboarded) return <SafeAreaView style={s.shell}><StatusBar style="light" /><ScrollView contentContainerStyle={s.content}>
    <Text style={s.brand}>juju<Text style={{ color: '#a3f6ca' }}>.</Text></Text><Text style={[s.title, { marginTop: 36 }]}>A clearer view{'\n'}of every pick.</Text>
    <Text style={s.body}>NFL research, price context, and a record you can revisit. Passing is a decision, too.</Text>
    <View style={s.notice}><Text style={s.noticeTitle}>Interactive prototype · sample data</Text><Text style={s.body}>All games, odds, probabilities, evidence, and outcomes are illustrative. No live advice, accounts, or sportsbook connection.</Text></View>
    <Text style={s.section}>Choose your books</Text><View style={s.wrap}>{BOOKS.map(b => <Chip key={b} text={b} selected={preferences.books.includes(b)} onPress={() => toggleBook(b)} />)}</View>
    <Text style={s.small}>Proposed launch policy: adults 21+ in supported US jurisdictions. This prototype does not verify age or location; those controls are required before public release.</Text>
    <Button title="Explore the demo" onPress={() => setPreferences(p => ({ ...p, onboarded: true }))} />
  </ScrollView></SafeAreaView>;
  return <SafeAreaView style={s.shell}><StatusBar style="light" />
    <View style={s.header}><Text style={s.brand}>juju<Text style={{ color: '#a3f6ca' }}>.</Text></Text><Pressable accessibilityRole="button" onPress={() => setSettings(true)}><Text style={s.small}>Preferences ⚙</Text></Pressable></View>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.banner}><Text style={s.bannerText}>DEMO MODE · FICTIONAL DATA · NO LIVE FEEDS</Text></View>{!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      <Text style={s.eyebrow}>NFL / RESEARCH DESK</Text><Text style={s.title}>{tab === 'Picks' ? 'Find your edge.' : tab === 'Games' ? 'The weekly slate.' : tab === 'My Picks' ? 'Your decision log.' : 'Every pick counts.'}</Text>
      <Text style={s.body}>{tab === 'Picks' ? 'Explore price, evidence, and the reasons to pass.' : tab === 'Games' ? 'Follow the matchup, even when there is no pick.' : tab === 'My Picks' ? 'Saved research and recorded bets stay separate.' : 'Losses, pushes, and withdrawals stay in the record.'}</Text>
      {tab === 'Picks' && <><View style={s.row}><Text style={s.section}>Sample opportunities</Text><Text style={s.small}>{visible.length} shown</Text></View><View style={s.wrap}>{BOOKS.map(b => <Chip key={b} text={b} selected={preferences.books.includes(b)} onPress={() => toggleBook(b)} />)}</View>{visible.map(card)}{!visible.length && <View style={s.card}><Text style={s.match}>No sample picks available</Text><Text style={s.body}>Choose a supported book, or inspect games. Demo picks expire at their fixed kickoff times.</Text></View>}<View style={s.notice}><Text style={s.noticeTitle}>Waiting is part of the process</Text><Text style={s.body}>The Seattle–San Francisco sample is watching an unresolved input. No pick is published.</Text><Button title="Inspect game" secondary onPress={() => open(picks[2])} /></View></>}
      {tab === 'Games' && <>{picks.slice(0, 3).map(card)}<Text style={s.small}>Sample fixtures are fixed, not an actual NFL schedule.</Text></>}
      {tab === 'My Picks' && <><Text style={s.section}>Saved research · {saved.length}</Text>{saved.length ? picks.filter(p => saved.includes(p.id)).map(card) : <View style={s.card}><Text style={s.match}>Keep a pick for later</Text><Text style={s.body}>Open an analysis and save it here. Saving does not record a bet.</Text><Button title="Browse picks" secondary onPress={() => setTab('Picks')} /></View>}<Text style={s.section}>Recorded external bets · {bets.length}</Text>{bets.map(b => { const p = picks.find(v => v.id === b.pickId)!; return <View key={b.id} style={s.card}><Text style={s.match}>{p.selection} · {p.market}</Text><Text style={s.body}>{b.book} · {b.line !== null ? `line ${b.line} · ` : ''}{american(b.odds)}{b.stake !== null ? ` · $${b.stake.toFixed(2)} recorded stake` : ''}</Text><Text style={s.small}>Original sample: {label(p)} at {american(p.odds)}{'\n'}Manual record · settlement pending · no sportsbook connection</Text><Button title="View original analysis" secondary onPress={() => open(p)} /><Button title="Delete record" secondary onPress={() => setBets(prev => prev.filter(v => v.id !== b.id))} /></View>; })}{!bets.length && <Text style={s.body}>No external bets recorded. Actual book, line, and price are entered separately from the original sample pick.</Text>}</>}
      {tab === 'Results' && <><View style={s.card}><Text style={s.eyebrow}>ILLUSTRATIVE PUBLISHED COHORT</Text><Text style={s.selection}>3 records · demo-v1</Text><Text style={s.body}>1 win · 1 loss · 1 push{'\n'}Includes 1 withdrawn recommendation.</Text><Text style={s.small}>This tiny fictional sample cannot establish performance. No ROI, profitability, or validated edge claims are made.</Text></View>{picks.filter(p => p.outcome !== 'pending').map(p => <View key={p.id}>{card(p)}<Text style={[s.small, { marginTop: 8, marginLeft: 8 }]}>Sample outcome: {p.outcome.toUpperCase()} · original quote retained</Text></View>)}<Text style={s.small}>Personal bets are excluded. Live settlement and model evaluation are not connected.</Text></>}
      <Text style={[s.small, { textAlign: 'center', marginTop: 12 }]}>Research can end with a pass. No bets are placed in juju.</Text>
    </ScrollView>
    <View style={s.nav}>{(['Picks', 'Games', 'My Picks', 'Results'] as Tab[]).map((t, i) => <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={s.navItem}><Text style={{ color: tab === t ? '#a3f6ca' : '#728696', fontSize: 20 }}>{['◇', '▦', '▱', '↗'][i]}</Text><Text style={[s.small, { color: tab === t ? '#a3f6ca' : '#728696' }]}>{t}</Text></Pressable>)}</View>
    <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}><SafeAreaView style={s.shell}><ScrollView contentContainerStyle={s.content}><Button title="← Back" secondary onPress={() => setSettings(false)} /><Text style={s.title}>Preferences</Text><Text style={s.section}>Supported books</Text><View style={s.wrap}>{BOOKS.map(b => <Chip key={b} text={b} selected={preferences.books.includes(b)} onPress={() => toggleBook(b)} />)}</View><Text style={s.body}>Demo data is stored only on this device. No account is created. Push alerts and location verification are not enabled.</Text><Button title="Clear saved research and bet records" secondary onPress={() => { setSaved([]); setBets([]); }} /><Text style={s.small}>Public launch requires eligibility controls, privacy and account deletion, licensed feeds, and distribution review.</Text></ScrollView></SafeAreaView></Modal>
    <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}><SafeAreaView style={s.shell}>{detail && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Button title="← Back to research" secondary onPress={() => setDetail(null)} /><View style={s.banner}><Text style={s.bannerText}>SAMPLE ANALYSIS · NOT A LIVE RECOMMENDATION</Text></View><Text style={s.eyebrow}>{detail.market.toUpperCase()} / {status(detail)}</Text><Text style={s.title}>{label(detail)}</Text><Text style={s.body}>{detail.away} at {detail.home}</Text>
      <View style={s.card}><View style={s.row}><Text style={s.match}>{detail.book}</Text><Text style={s.quote}>{american(detail.odds)}</Text></View><Text style={s.small}>Fictional quote · static dataset · {detail.version}</Text><View style={[s.row, { marginTop: 20 }]}><View><Text style={s.small}>Sample win probability</Text><Text style={s.selection}>{percent(detail.win)}</Text></View><View><Text style={s.small}>Price break-even*</Text><Text style={s.selection}>{percent(price(detail.win, detail.push, detail.odds).breakEven)}</Text></View></View><Text style={s.body}>Illustrative expected return: {percent(price(detail.win, detail.push, detail.odds).expectedReturn)} per unit{detail.push > 0 ? ` · push probability ${percent(detail.push)}` : ''}</Text><Text style={s.small}>*Break-even applies conditional on a non-push outcome. Numerical edge and acceptable-price recommendations are withheld because no model has been validated.</Text></View>
      <Text style={s.section}>Supporting evidence</Text>{detail.evidence.map(e => <Text key={e} style={s.body}>• {e}</Text>)}<Text style={s.section}>Reasons to pause</Text>{detail.risks.map(r => <Text key={r} style={s.body}>• {r}</Text>)}<Text style={s.small}>Source: authored sample fixtures in src/demo.ts. No verified injury, weather, or historical performance sources.</Text>
      <Button title={saved.includes(detail.id) ? 'Remove saved pick' : 'Save research'} onPress={() => setSaved(prev => prev.includes(detail.id) ? prev.filter(id => id !== detail.id) : [...prev, detail.id])} /><Button title="Record an external bet" secondary onPress={startRecord} />
      {recording && <View style={s.card}><Text style={s.section}>Your actual price</Text><Text style={s.small}>This records an external bet; it does not place one. Demo records are not automatically graded.</Text><View style={s.wrap}>{BOOKS.map(b => <Chip key={b} text={b} selected={book === b} onPress={() => setBook(b)} />)}</View><Field title="American odds" value={odds} onChange={setOdds} placeholder="+110 or -125" />{detail.market !== 'Moneyline' && <Field title="Actual line" value={line} onChange={setLine} />}<Field title="Stake in USD (optional)" value={stake} onChange={setStake} placeholder="Leave blank to omit" />{!!formError && <Text accessibilityRole="alert" style={s.error}>{formError}</Text>}<Button title="Save external bet record" onPress={record} /><Button title="Cancel" secondary onPress={() => setRecording(false)} /></View>}
      <View style={s.notice}><Text style={s.noticeTitle}>Ask about this pick</Text><Text style={s.small}>Deterministic demo assistant · no AI service connected. Price questions keep the same line.</Text><View style={s.wrap}>{['Is this worth taking at -125?', 'What is the main risk?', 'Are there current injuries?'].map(q => <Chip key={q} text={q} onPress={() => { setQuestion(q); setAnswer(agentReply(detail, q)); }} />)}</View><Field title="Your question" value={question} onChange={setQuestion} placeholder="Is this worth taking at -125?" /><Button title="Ask demo assistant" disabled={!question.trim()} onPress={() => setAnswer(agentReply(detail, question))} />{!!answer && <Text selectable style={s.body}>{answer}</Text>}</View>
    </ScrollView>}</SafeAreaView></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0c1722' }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, gap: 16, paddingBottom: 40 },
  header: { width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  brand: { color: '#f1f6f9', fontSize: 34, fontWeight: '800', letterSpacing: -2 }, title: { fontSize: 36, lineHeight: 42, fontWeight: '700', color: '#f1f6f9', letterSpacing: -1.2 },
  eyebrow: { color: '#8fa3b4', fontSize: 11, letterSpacing: 1.8, fontWeight: '700' }, body: { color: '#bac9d5', fontSize: 15, lineHeight: 24 }, small: { color: '#96a9ba', fontSize: 12, lineHeight: 19 }, muted: { color: '#8096a8' },
  section: { fontSize: 18, fontWeight: '600', color: '#edf3f7', marginTop: 6 }, match: { color: '#edf3f7', fontSize: 18, fontWeight: '600' }, selection: { color: '#edf3f7', fontSize: 23, fontWeight: '600' }, quote: { color: '#a3f6ca', fontSize: 28, fontWeight: '700' },
  card: { backgroundColor: '#152433', borderWidth: 1, borderColor: '#293b4c', borderRadius: 20, padding: 20, gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#344858' }, button: { backgroundColor: '#a3f6ca', padding: 15, borderRadius: 13, alignItems: 'center', minHeight: 48 }, buttonText: { color: '#142a22', fontSize: 14, fontWeight: '700' }, secondary: { backgroundColor: '#213342', borderWidth: 1, borderColor: '#344858' },
  notice: { backgroundColor: '#182b2b', borderColor: '#2d4944', borderWidth: 1, borderRadius: 20, padding: 20, gap: 14 }, noticeTitle: { color: '#b5ead4', fontSize: 17, fontWeight: '600' }, banner: { backgroundColor: '#332b24', padding: 10, borderRadius: 8 }, bannerText: { color: '#e5bc8f', fontSize: 10, fontWeight: '700', letterSpacing: .7 },
  nav: { width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', borderTopWidth: 1, borderColor: '#293b4c', paddingVertical: 12 }, navItem: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 }, input: { borderColor: '#405466', borderWidth: 1, borderRadius: 12, padding: 14, color: '#eef4f8', backgroundColor: '#0f1e2b', fontSize: 16 }, error: { color: '#ffc1b5', fontSize: 14, lineHeight: 22 },
});
