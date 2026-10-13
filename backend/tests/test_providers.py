import copy
import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from backend.providers import ProviderError, Providers, normalize_odds, quote_status
from backend.store import BudgetExceeded, Store

NOW = datetime(2026, 10, 12, 20, tzinfo=timezone.utc)
AT = NOW.isoformat()
EVENT = {'id': 'game1', 'sport_key': 'americanfootball_nfl', 'home_team': 'Home', 'away_team': 'Away', 'commence_time': (NOW + timedelta(hours=3)).isoformat(), 'bookmakers': [{'key': 'draftkings', 'title': 'DraftKings', 'last_update': AT, 'markets': [{'key': 'spreads', 'last_update': AT, 'outcomes': [{'name': 'Away', 'point': 3, 'price': -110}, {'name': 'Home', 'point': -3, 'price': -110}]}]}]}


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'research.sqlite'
        self.store = Store(self.path)

    def test_exact_lines_and_provider_timestamps_survive_normalization(self):
        rows = normalize_odds([EVENT], 'nfl', AT)
        self.assertEqual([row['line'] for row in rows], [3, -3])
        self.assertEqual(rows[0]['providerUpdatedAt'], AT)
        self.assertFalse(rows[0]['recommendationEnabled'])
        self.assertEqual(normalize_odds([EVENT], 'ncaaf', AT), [])

    def test_missing_market_timestamp_cannot_be_replaced_by_ingestion_time(self):
        event = copy.deepcopy(EVENT)
        del event['bookmakers'][0]['markets'][0]['last_update']
        rows = normalize_odds([event], 'nfl', AT)
        self.assertEqual(rows[0]['providerUpdatedAt'], AT)
        self.assertEqual(rows[0]['timestampScope'], 'book')
        self.assertEqual(quote_status(rows[0], NOW), 'book_timestamp_only')
        del event['bookmakers'][0]['last_update']
        rows = normalize_odds([event], 'nfl', AT)
        self.assertIsNone(rows[0]['providerUpdatedAt'])
        self.assertEqual(quote_status(rows[0], NOW), 'unavailable')

    def test_stale_future_and_kickoff_states(self):
        row = normalize_odds([EVENT], 'nfl', AT)[0]
        self.assertEqual(quote_status(row, NOW), 'current')
        self.assertEqual(quote_status(row, NOW + timedelta(minutes=6)), 'stale')
        self.assertEqual(quote_status(row, NOW - timedelta(seconds=1)), 'unavailable')
        self.assertEqual(quote_status(row, NOW + timedelta(hours=3)), 'expired')
        row['kickoff'] = (NOW + timedelta(minutes=30)).isoformat()
        self.assertEqual(quote_status(row, NOW + timedelta(minutes=3)), 'stale')

    def test_budget_is_atomic_persistent_and_shared_across_leagues(self):
        def reserve(_):
            try:
                Store(self.path).reserve('odds', 3, 6, 6, NOW)
                return True
            except BudgetExceeded:
                return False
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(reserve, range(8))), 2)
        self.assertEqual(Store(self.path).usage('odds', NOW)['monthlyReservedCredits'], 6)

    @patch.dict(os.environ, {'ODDS_API_KEY': 'test-only-key'}, clear=True)
    def test_cache_prevents_duplicate_requests_and_failure_retains_reservation(self):
        calls = []
        def transport(url):
            calls.append(url)
            return json.dumps([EVENT]).encode(), {'x-requests-last': '3', 'x-requests-remaining': '90'}
        client = Providers(self.store, transport, lambda: NOW)
        client.odds('nfl'); client.odds('nfl')
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.store.usage('odds', NOW)['monthlyReservedCredits'], 3)
        def fail(url):
            raise ProviderError('Connection failed')
        with self.assertRaises(ProviderError):
            Providers(self.store, fail, lambda: NOW).odds('ncaaf')
        self.assertEqual(self.store.usage('odds', NOW)['monthlyReservedCredits'], 6)

    @patch.dict(os.environ, {'ODDS_API_KEY': 'test-only-key'}, clear=True)
    def test_provider_quota_exhaustion_blocks_other_league(self):
        calls = []
        def transport(url):
            calls.append(url)
            return json.dumps([EVENT]).encode(), {'x-requests-remaining': '0'}
        client = Providers(self.store, transport, lambda: NOW)
        client.odds('nfl')
        with self.assertRaises(BudgetExceeded):
            client.odds('ncaaf')
        self.assertEqual(len(calls), 1)

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_credentials_never_call_providers_or_spend_quota(self):
        def fail(*args):
            self.fail('Network request should not occur')
        client = Providers(self.store, fail, lambda: NOW)
        with self.assertRaises(ProviderError):
            client.odds('nfl')
        with self.assertRaises(ProviderError):
            client.college(2026, 7)
        self.assertEqual(self.store.usage('odds', NOW)['monthlyReservedCredits'], 0)

    @patch.dict(os.environ, {'CFBD_API_KEY': 'test-only-key'}, clear=True)
    def test_college_snapshots_preserve_availability_limit_and_cache(self):
        calls = []
        def transport(url, headers):
            calls.append(url)
            self.assertIn('Authorization', headers)
            self.assertNotIn('test-only-key', url)
            return b'[]', {}
        client = Providers(self.store, transport, lambda: NOW)
        data = client.college(2026, 7)
        client.college(2026, 7)
        self.assertEqual(len(calls), 2)
        self.assertFalse(data['data']['historicalAvailabilityVerified'])
        self.assertEqual(self.store.usage('cfbd', NOW)['monthlyReservedCredits'], 2)

    def test_nfl_schedule_filters_season_without_claiming_known_at_prediction_time(self):
        body = b'game_id,season,home_team,away_team\na,2026,H,A\nb,2025,H,A\n'
        client = Providers(self.store, lambda url: (body, {}), lambda: NOW)
        snapshot = client.nfl_schedule(2026)
        self.assertEqual(len(snapshot['data']['games']), 1)
        self.assertFalse(snapshot['data']['historicalAvailabilityVerified'])

    def test_snapshots_append_instead_of_overwriting(self):
        self.store.save('odds', 'nfl', {'quotes': ['original']}, NOW)
        self.store.save('odds', 'nfl', {'quotes': ['revised']}, NOW)
        with self.store.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0], 2)
        self.assertEqual(self.store.latest('odds', 'nfl')['data']['quotes'], ['revised'])


if __name__ == '__main__':
    unittest.main()
