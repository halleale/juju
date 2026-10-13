import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Pick } from '../domain';
import { american, validOdds } from '../domain';
import { analyze, priceExplanation } from '../analysis';

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
export default function ResearchBrief({ pick, now }: { pick: Pick; now: number }) {
  const [oddsText, setOddsText] = useState(String(pick.odds));
  const [lineText, setLineText] = useState(pick.line === null ? '' : String(pick.line));
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const odds = Number(oddsText);
  const line = pick.market === 'Moneyline' ? null : lineText.trim() ? Number(lineText) : NaN;
  const original = odds === pick.odds && line === pick.line;
  const result = analyze(pick, now, { odds, line, source: original ? 'stored' : 'user' });
  const snapshot = pick.research;
  const completeSources = snapshot?.sources || [];
  return <View style={s.root}>
    <View style={s.panel}><Text style={s.tag}>THE DECISION BRIEF</Text><Text style={s.heading}>No actionable recommendation</Text><Text style={s.body}>Price arithmetic is only one part of the decision. Verified evidence, freshness, uncertainty, and model validation must also pass.</Text></View>
    <Text style={s.heading}>Why this price?</Text>
    <View style={s.panel}><Text style={s.body}>{priceExplanation(pick)}</Text><Text style={s.small}>Illustrative calculations using authored probabilities. They are not a validated advantage.</Text>{snapshot && <><Text style={s.body}>Sample win-probability range: {pct(snapshot.winRange[0])}–{pct(snapshot.winRange[1])}</Text><Text style={s.small}>An illustrative sensitivity range, not a measured confidence interval. At its lower bound, expected return is {pct(analyze(pick, now).conservativeReturn || 0)} per unit.</Text></>}</View>
    <Text style={s.heading}>Supporting and opposing evidence</Text>
    {snapshot?.factors.map(factor => <View key={factor.id} style={s.panel}>
      <Text style={[s.tag, { color: factor.direction === 'supports' ? '#a3f6ca' : '#f2c18b' }]}>{factor.direction.toUpperCase()} · {factor.status === 'unresolved' ? 'UNRESOLVED' : 'SAMPLE SCENARIO'}</Text>
      <Text style={s.factor}>{factor.title}</Text><Text style={s.body}>{factor.observation}</Text>
      <Text style={s.small}>Why it matters</Text><Text style={s.body}>{factor.relevance}</Text>
      <Text style={s.small}>{factor.modelUse === 'input' ? 'Planned model input; no measured contribution in this demo.' : 'Context / pause condition; not a quantified model contribution.'}</Text>
      <Text style={s.small}>Pass or reevaluate when: {factor.invalidatedBy}</Text>
      {factor.sourceIds.map(id => <Pressable key={id} accessibilityRole="button" onPress={() => setSourcesOpen(true)} style={s.sourceButton}><Text style={s.link}>Source: {completeSources.find(source => source.id === id)?.name || 'Missing source'} ↓</Text></Pressable>)}
    </View>)}
    <Text style={s.heading}>Check the price you see</Text>
    <View style={s.panel}><Text style={s.small}>American odds</Text><TextInput accessibilityLabel="Check American odds" value={oddsText} onChangeText={setOddsText} style={s.input} />{pick.market !== 'Moneyline' && <><Text style={s.small}>Exact line</Text><TextInput accessibilityLabel="Check exact line" value={lineText} onChangeText={setLineText} style={s.input} /></>}
      {result.pricing && <><Text style={s.factor}>{american(odds)} · {result.pricing.expectedReturn > 0 ? 'positive sample arithmetic' : 'pass at this price'}</Text><Text style={s.body}>{priceExplanation(pick, odds)}</Text></>}
      {!validOdds(odds) && <Text accessibilityRole="alert" style={s.warning}>Use whole American odds, such as +110 or -125.</Text>}
      <Text style={s.small}>{original ? 'Original fictional quote. No availability verification.' : 'User-supplied quote. No availability verification.'}</Text>
      <Text style={s.factor}>Why we are passing or waiting</Text>{result.blockers.map(reason => <Text key={reason} style={s.body}>• {reason}</Text>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: sourcesOpen }} onPress={() => setSourcesOpen(!sourcesOpen)} style={s.sourceButton}><Text style={s.link}>{sourcesOpen ? 'Hide' : 'Inspect'} sources and original snapshot {sourcesOpen ? '↑' : '↓'}</Text></Pressable>
    {sourcesOpen && <View style={s.panel}><Text style={s.factor}>Original research snapshot</Text><Text selectable style={s.small}>Snapshot: {snapshot?.id || 'missing'}{'\n'}Model: {pick.version} · unvalidated{'\n'}Rule: {snapshot?.qualification.version || 'missing'} · unvalidated{'\n'}Analysis: {snapshot?.analyzedAt || 'unknown'}{'\n'}Quote provider update: {snapshot?.quoteUpdatedAt || 'unknown'}{'\n'}Quote ingestion: {snapshot?.quoteIngestedAt || 'unknown'}</Text><Text style={s.warning}>These UTC timestamps belong to fixed fictional fixtures. Opening the app does not refresh them.</Text>{completeSources.map(source => <View key={source.id} style={{ gap: 6 }}><Text style={s.factor}>{source.name}</Text><Text selectable style={s.small}>ID: {source.id}{'\n'}Type: {source.kind}{'\n'}Observed: {source.observedAt}{'\n'}Ingested: {source.ingestedAt}{'\n'}Reference: {source.reference}</Text></View>)}</View>}
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 16 }, panel: { backgroundColor: '#152433', borderWidth: 1, borderColor: '#293b4c', borderRadius: 20, padding: 20, gap: 12 },
  heading: { fontSize: 20, fontWeight: '600', color: '#edf3f7' }, factor: { fontSize: 16, fontWeight: '600', color: '#edf3f7' },
  tag: { color: '#f2c18b', fontSize: 11, letterSpacing: 1, fontWeight: '700' }, body: { color: '#bac9d5', fontSize: 15, lineHeight: 24 }, small: { color: '#96a9ba', fontSize: 12, lineHeight: 19 },
  input: { borderColor: '#405466', borderWidth: 1, borderRadius: 12, padding: 14, color: '#eef4f8', backgroundColor: '#0f1e2b', fontSize: 16 },
  link: { color: '#a3f6ca', fontSize: 13, lineHeight: 20 }, sourceButton: { paddingVertical: 12, minHeight: 44 }, warning: { color: '#f2c18b', fontSize: 12, lineHeight: 19 },
});
