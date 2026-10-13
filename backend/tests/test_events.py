import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.api import slate
from backend.events import match_schedule
from backend.store import Store, utcnow

EVENT = {'eventId': 'odds-game', 'league': 'nfl', 'home': 'Los Angeles Rams', 'away': 'Buffalo Bills', 'kickoff': '2026-10-13T00:15:45Z'}
GAME = {'game_id': '2026_05_BUF_LA', 'home_team': 'LA', 'away_team': 'BUF', 'gameday': '2026-10-12', 'gametime': '20:15', 'week': '5'}
SNAPSHOT = {'snapshotId': 1, 'ingestedAt': '2026-10-13T02:00:00Z', 'data': {'games': [GAME]}}


class EventTests(unittest.TestCase):
    def test_nfl_eastern_time_and_provider_ids_remain_distinct(self):
        result = match_schedule(EVENT, {'2026': SNAPSHOT})
        self.assertEqual(result['status'], 'matched')
        self.assertEqual(result['sourceEventId'], GAME['game_id'])
        self.assertEqual(result['scheduledKickoff'], '2026-10-13T00:15:00+00:00')
        self.assertFalse(result['historicalAvailabilityVerified'])

    def test_wrong_date_orientation_unknown_alias_and_ambiguous_records_abstain(self):
        for changes in [{'kickoff': '2026-10-14T00:15:00Z'}, {'home': 'Buffalo Bills', 'away': 'Los Angeles Rams'}, {'home': 'Unknown Rams'}]:
            self.assertEqual(match_schedule({**EVENT, **changes}, {'2026': SNAPSHOT})['status'], 'unmatched')
        duplicate = copy.deepcopy(SNAPSHOT)
        duplicate['data']['games'].append(GAME)
        self.assertEqual(match_schedule(EVENT, {'2026': duplicate})['status'], 'ambiguous')

    def test_college_names_disambiguate_state_and_miami_and_reject_tbd(self):
        event = {**EVENT, 'league': 'ncaaf', 'home': 'Miami (OH) RedHawks', 'away': 'Michigan State Spartans'}
        game = {'id': 10, 'homeTeam': 'Miami (OH)', 'awayTeam': 'Michigan State', 'startDate': EVENT['kickoff'], 'homeClassification': 'fbs', 'awayClassification': 'fbs'}
        snapshot = {**SNAPSHOT, 'data': {'games': [game], 'advancedStats': []}}
        result = match_schedule(event, {'2026-7': snapshot})
        self.assertEqual(result['status'], 'matched')
        self.assertTrue(result['fbsMatchup'])
        self.assertEqual(result['advancedStatsStatus'], 'unavailable')
        self.assertEqual(match_schedule({**event, 'home': 'Miami Hurricanes'}, {'2026-7': snapshot})['status'], 'unmatched')
        game['startTimeTBD'] = True
        self.assertEqual(match_schedule(event, {'2026-7': snapshot})['status'], 'unmatched')

    def test_api_reads_use_latest_each_target_and_never_spend_provider_quota(self):
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / 'research.sqlite')
            db = Store(path)
            now = utcnow()
            quote = {**EVENT, 'providerUpdatedAt': now.isoformat(), 'timestampScope': 'market', 'recommendationEnabled': False}
            db.save('odds', 'nfl', {'quotes': [quote]}, now)
            db.save('nflverse', '2026', {'games': []}, now)
            db.save('nflverse', '2026', {'games': [GAME]}, now)
            with patch.dict('os.environ', {'RESEARCH_DB_PATH': path}):
                response = slate('nfl')
                self.assertEqual(response['events'][0]['schedule']['status'], 'matched')
                self.assertFalse(response['recommendationsEnabled'])
                self.assertEqual(response['quotes'][0]['status'], 'expired')
                self.assertIn('asOf', response)
            self.assertEqual(db.usage('odds', now)['monthlyReservedCredits'], 0)
            self.assertEqual(len(db.latest_targets('nflverse')), 1)


if __name__ == '__main__':
    unittest.main()
