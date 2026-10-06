import type { AlertItem, Pick, SettledPick, Sport, BetType } from './types';

/** Sample data matching the approved designs. Replaced by the scored feed in build step 3. */

export const SPORTS: Sport[] = ['NFL', 'MLB', 'NHL', 'NBA', 'College FB', 'Soccer', 'Tennis', 'Golf'];
export const BET_TYPES: BetType[] = ['Spreads', 'Totals', 'Moneylines', 'Player props', 'Parlays', 'Futures'];

export const MARKETS_SCANNED = 1284;

export const TEAMS: { name: string; short: string; sport: Sport }[] = [
  { name: 'Buffalo Bills', short: 'Bills', sport: 'NFL' },
  { name: 'Miami Dolphins', short: 'Dolphins', sport: 'NFL' },
  { name: 'Detroit Lions', short: 'Lions', sport: 'NFL' },
  { name: 'Cincinnati Bengals', short: 'Bengals', sport: 'NFL' },
  { name: 'Kansas City Chiefs', short: 'Chiefs', sport: 'NFL' },
  { name: 'Philadelphia Eagles', short: 'Eagles', sport: 'NFL' },
  { name: 'Seattle Mariners', short: 'Mariners', sport: 'MLB' },
  { name: 'Detroit Tigers', short: 'Tigers', sport: 'MLB' },
  { name: 'New York Yankees', short: 'Yankees', sport: 'MLB' },
  { name: 'Los Angeles Dodgers', short: 'Dodgers', sport: 'MLB' },
  { name: 'New York Rangers', short: 'Rangers', sport: 'NHL' },
  { name: 'New Jersey Devils', short: 'Devils', sport: 'NHL' },
  { name: 'Boston Bruins', short: 'Bruins', sport: 'NHL' },
  { name: 'Boston Celtics', short: 'Celtics', sport: 'NBA' },
  { name: 'Denver Nuggets', short: 'Nuggets', sport: 'NBA' },
];

export const PICKS: Pick[] = [
  {
    id: 'buf-mia-under',
    sport: 'NFL',
    marketType: 'total',
    time: 'Sun 1:00 PM',
    away: 'Bills',
    home: 'Dolphins',
    selection: 'Under 47.5',
    modelProb: 0.575,
    confidence: 'High',
    why: 'Wind forecast above 15 mph and both offenses have slowed their pace over the last three weeks.',
    signals: [
      { pro: true, title: 'Wind 15 to 20 mph forecast', detail: 'Totals in games this windy have gone under at a higher rate than the market prices in.' },
      { pro: true, title: 'Both offenses slowing down', detail: 'Plays per game down for both teams over the last three weeks.' },
      { pro: true, title: 'Line already moving our way', detail: 'Dropped two points since open, a sign other sharp bettors agree.' },
      { pro: false, title: 'Big-play risk', detail: 'Miami’s offense can score quickly, which adds variance to any under.' },
    ],
    books: [
      { book: 'Sportsbook B', price: -110 },
      { book: 'Sportsbook A', price: -108 },
      { book: 'Sportsbook C', price: -112 },
    ],
    line: { label: 'Total', open: 49.5, points: [49.5, 49.5, 49, 48.5, 48, 47.5], startLabel: 'Mon', nowLabel: '47.5' },
  },
  {
    id: 'sea-det-ml',
    sport: 'MLB',
    marketType: 'moneyline',
    time: 'Tonight 7:08 PM',
    away: 'Mariners',
    home: 'Tigers',
    selection: 'Mariners ML',
    modelProb: 0.46,
    confidence: 'Medium',
    why: 'Seattle’s starter matches up well against this lineup and the price has not moved to reflect it.',
    signals: [
      { pro: true, title: 'Starter matchup', detail: 'Seattle’s starter has handled this lineup’s handedness split well this season.' },
      { pro: true, title: 'Price has not moved', detail: 'Still at the opening number while the consensus fair price has shortened.' },
      { pro: false, title: 'Road underdog', detail: 'Plus-money prices carry more variance, so size accordingly.' },
    ],
    books: [
      { book: 'Sportsbook A', price: 140 },
      { book: 'Sportsbook B', price: 145 },
      { book: 'Sportsbook C', price: 138 },
    ],
    line: { label: 'Price', open: 145, points: [145, 145, 142, 145, 145, 145], startLabel: 'Yesterday', nowLabel: '+145' },
  },
  {
    id: 'det-cin-te-rec',
    sport: 'NFL',
    marketType: 'prop',
    time: 'Sun 4:25 PM',
    away: 'Lions',
    home: 'Bengals',
    selection: 'Lions TE o4.5 rec',
    modelProb: 0.505,
    confidence: 'Medium',
    why: 'Target share up three straight weeks against a defense that struggles to cover tight ends.',
    signals: [
      { pro: true, title: 'Target share rising', detail: 'Up three straight weeks.' },
      { pro: true, title: 'Soft coverage matchup', detail: 'This defense has struggled to cover tight ends.' },
      { pro: false, title: 'Practice status', detail: 'Check the final injury report before kickoff.' },
    ],
    books: [
      { book: 'Sportsbook C', price: 120 },
      { book: 'Sportsbook A', price: 110 },
    ],
    line: { label: 'Price', open: 105, points: [105, 110, 110, 115, 120, 120], startLabel: 'Wed', nowLabel: '+120' },
  },
  {
    id: 'njd-nyr-over',
    sport: 'NHL',
    marketType: 'total',
    time: 'Thu 7:00 PM',
    away: 'Devils',
    home: 'Rangers',
    selection: 'Over 5.5',
    modelProb: 0.555,
    confidence: 'Medium',
    why: 'Both teams are likely to start backup goalies on the second night of a back-to-back.',
    signals: [
      { pro: true, title: 'Backup goalies likely', detail: 'Both teams play the second night of a back-to-back.' },
      { pro: false, title: 'Starters not confirmed', detail: 'If either starter is announced, this edge shrinks.' },
    ],
    books: [
      { book: 'Sportsbook A', price: -105 },
      { book: 'Sportsbook B', price: -110 },
      { book: 'Sportsbook C', price: -115 },
    ],
    line: { label: 'Total', open: 5.5, points: [5.5, 5.5, 5.5, 5.5, 5.5, 5.5], startLabel: 'Tue', nowLabel: '5.5' },
  },
];

export const ALERTS: AlertItem[] = [
  { id: 'a1', kind: 'new_edge', title: 'New edge: Bills/Dolphins Under 47.5', body: '+5.6 pts vs the market. Matches a team you follow.', ago: '12 min ago', pickId: 'buf-mia-under' },
  { id: 'a2', kind: 'line_move', title: 'Line moved on a pick you track', body: 'Rangers/Devils total now 6. Edge dropped to +1.9, below your threshold.', ago: '2 hr ago', pickId: 'njd-nyr-over' },
  { id: 'a3', kind: 'pulled', title: 'Injury news changed a pick', body: 'Lions TE prop pulled after a practice report. Removed from your feed.', ago: 'Yesterday' },
];

export const SETTLED: SettledPick[] = [
  { id: 's1', sport: 'NFL', marketType: 'total', label: 'Jets/Patriots Under 41.5', date: 'Sep 29', alertPrice: -110, closingPrice: -118, result: 'win' },
  { id: 's2', sport: 'MLB', marketType: 'moneyline', label: 'Guardians ML', date: 'Sep 28', alertPrice: 130, closingPrice: 118, result: 'loss' },
  { id: 's3', sport: 'NFL', marketType: 'spread', label: 'Chiefs -3', date: 'Sep 28', alertPrice: -105, closingPrice: -112, result: 'win' },
  { id: 's4', sport: 'NHL', marketType: 'total', label: 'Bruins/Leafs Over 6', date: 'Sep 27', alertPrice: -102, closingPrice: -102, result: 'push' },
  { id: 's5', sport: 'NFL', marketType: 'prop', label: 'Eagles WR o62.5 yds', date: 'Sep 22', alertPrice: -110, closingPrice: -120, result: 'win' },
  { id: 's6', sport: 'MLB', marketType: 'total', label: 'Dodgers/Padres Under 8.5', date: 'Sep 21', alertPrice: -108, closingPrice: -104, result: 'loss' },
  { id: 's7', sport: 'NFL', marketType: 'spread', label: 'Bills -2.5', date: 'Sep 21', alertPrice: -110, closingPrice: -125, result: 'win' },
  { id: 's8', sport: 'MLB', marketType: 'moneyline', label: 'Mariners ML', date: 'Sep 20', alertPrice: 150, closingPrice: 135, result: 'win' },
];
