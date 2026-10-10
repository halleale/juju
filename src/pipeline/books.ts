/** Display names for the book ids the pipeline stores. Unknown ids are shown as-is. */
export const BOOK_LABELS: Record<string, string> = {
  pinnacle: 'Pinnacle',
  lowvig: 'LowVig',
  betonlineag: 'BetOnline',
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  williamhill_us: 'Caesars',
  espnbet: 'ESPN BET',
  fanatics: 'Fanatics',
  betrivers: 'BetRivers',
};

export function bookLabel(book: string): string {
  return BOOK_LABELS[book] ?? book;
}
