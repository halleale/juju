import csv
import io
import json
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from .store import BudgetExceeded, Store, utcnow

SPORTS = {'nfl': 'americanfootball_nfl', 'ncaaf': 'americanfootball_ncaaf'}
MARKETS = {'h2h': 'Moneyline', 'spreads': 'Spread', 'totals': 'Total'}
BOOKS = {'draftkings', 'fanduel', 'betmgm'}


class ProviderError(Exception):
    pass


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except (ValueError, TypeError, AttributeError):
        return None


def request(url, headers=None):
    # Preserve TLS verification. Never surface an exception URL: odds keys are in query parameters.
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'juju-research/0.1', **(headers or {})})
        with urllib.request.urlopen(req, timeout=20) as response:
            body = response.read(20_000_001)
            if len(body) > 20_000_000:
                raise ProviderError('Provider response exceeded the size limit.')
            return body, dict(response.headers.items())
    except urllib.error.HTTPError as error:
        raise ProviderError(f'Provider returned HTTP {error.code}; check access, plan coverage, and quota.') from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ProviderError('Provider connection failed; check network access.') from None


def normalize_odds(events, league, ingested_at):
    if not isinstance(events, list):
        raise ProviderError('Unexpected odds response shape.')
    rows = []
    for event in events:
        if not isinstance(event, dict) or not event.get('id') or event.get('sport_key') != SPORTS[league]:
            continue
        if not timestamp(event.get('commence_time')) or not event.get('home_team') or not event.get('away_team'):
            continue
        for book in event.get('bookmakers', []):
            if book.get('key') not in BOOKS:
                continue
            for market in book.get('markets', []):
                key = market.get('key')
                if key not in MARKETS:
                    continue
                # Preserve provider timestamp scope; never replace it with fetch time.
                updated = market.get('last_update') if timestamp(market.get('last_update')) else book.get('last_update')
                scope = 'market' if timestamp(market.get('last_update')) else 'book' if timestamp(book.get('last_update')) else 'unknown'
                for outcome in market.get('outcomes', []):
                    odds = outcome.get('price')
                    line = outcome.get('point') if key != 'h2h' else None
                    if not isinstance(odds, (int, float)) or isinstance(odds, bool) or not math.isfinite(odds) or int(odds) != odds or abs(odds) < 100:
                        continue
                    if key != 'h2h' and (not isinstance(line, (int, float)) or isinstance(line, bool) or not math.isfinite(line)):
                        continue
                    selection = outcome.get('name')
                    if key == 'totals' and selection not in ('Over', 'Under'):
                        continue
                    if key != 'totals' and selection not in (event['home_team'], event['away_team'], 'Draw'):
                        continue
                    rows.append({'eventId': event['id'], 'league': league, 'home': event['home_team'], 'away': event['away_team'], 'kickoff': event['commence_time'], 'period': 'full_game', 'market': MARKETS[key], 'selection': selection, 'line': line, 'odds': int(odds), 'book': book.get('title', book['key']), 'bookKey': book['key'], 'providerUpdatedAt': updated if timestamp(updated) else None, 'timestampScope': scope, 'bookUpdatedAt': book.get('last_update'), 'ingestedAt': ingested_at, 'provider': 'The Odds API', 'recommendationEnabled': False})
    return rows


def quote_status(quote, now):
    updated = timestamp(quote['providerUpdatedAt'])
    kickoff = timestamp(quote['kickoff'])
    if not kickoff or now >= kickoff:
        return 'expired'
    if not updated or updated > now:
        return 'unavailable'
    limit = 120 if (kickoff - now).total_seconds() <= 3600 else 300
    if (now - updated).total_seconds() > limit:
        return 'stale'
    return 'current' if quote.get('timestampScope') == 'market' else 'book_timestamp_only'


class Providers:
    def __init__(self, store: Store, transport=request, clock=utcnow):
        self.store, self.transport, self.clock = store, transport, clock

    def cached(self, provider, target, ttl=300):
        previous = self.store.latest(provider, target)
        return previous if previous and (self.clock() - timestamp(previous['ingestedAt'])).total_seconds() < ttl else None

    def odds(self, league):
        if league not in SPORTS:
            raise ValueError('Unsupported league')
        previous = self.cached('odds', league)
        if previous:
            return previous
        key = os.environ.get('ODDS_API_KEY')
        if not key:
            raise ProviderError('ODDS_API_KEY is not configured on the server.')
        latest = self.store.latest('odds')
        if latest and latest['ingestedAt'][:7] == self.clock().isoformat()[:7]:
            try:
                remaining = int(latest['data']['providerQuota']['x-requests-remaining'])
            except (ValueError, TypeError, KeyError):
                remaining = None
            if remaining is not None and remaining < 3:
                raise BudgetExceeded('Reported provider quota is insufficient; no request was sent. Recheck the allowance after a plan reset or change.')
        ticket = self.store.reserve('odds', 3, int(os.getenv('ODDS_DAILY_CREDIT_LIMIT', '30')), int(os.getenv('ODDS_MONTHLY_CREDIT_LIMIT', '450')), self.clock())
        params = urllib.parse.urlencode({'apiKey': key, 'regions': 'us', 'markets': 'h2h,spreads,totals', 'oddsFormat': 'american', 'dateFormat': 'iso'})
        body, headers = self.transport(f'https://api.the-odds-api.com/v4/sports/{SPORTS[league]}/odds?{params}')
        headers = {k.lower(): v for k, v in headers.items()}
        try:
            actual = max(3, int(headers.get('x-requests-last', '3')))
        except (ValueError, TypeError):
            actual = 3
        self.store.reconcile(ticket, actual)
        try:
            raw = json.loads(body)
        except (ValueError, TypeError):
            raise ProviderError('Provider returned invalid JSON.') from None
        data = {'quotes': normalize_odds(raw, league, self.clock().isoformat()), 'providerQuota': {k: headers.get(k) for k in ['x-requests-remaining', 'x-requests-used', 'x-requests-last']}}
        self.store.save('odds', league, data, self.clock())
        return self.store.latest('odds', league)

    def college(self, year, week):
        if not 2000 <= year <= 2100 or not 1 <= week <= 20:
            raise ValueError('Invalid season or week')
        target = f'{year}-{week}'
        previous = self.cached('cfbd', target, 21600)
        if previous:
            return previous
        key = os.getenv('CFBD_API_KEY')
        if not key:
            raise ProviderError('CFBD_API_KEY is not configured on the server.')
        # Two calls: schedules/results and advanced game statistics. Not injury reporting.
        self.store.reserve('cfbd', 2, int(os.getenv('CFBD_DAILY_REQUEST_LIMIT', '10')), int(os.getenv('CFBD_MONTHLY_REQUEST_LIMIT', '50')), self.clock())
        data = {}
        for label, path in [('games', '/games'), ('advancedStats', '/stats/game/advanced')]:
            params = {'year': year, 'week': week, 'seasonType': 'regular'}
            if label == 'games':
                params['classification'] = 'fbs'
            body, _ = self.transport('https://api.collegefootballdata.com' + path + '?' + urllib.parse.urlencode(params), {'Authorization': f'Bearer {key}'})
            try:
                rows = json.loads(body)
                if not isinstance(rows, list):
                    raise ValueError()
            except (ValueError, TypeError):
                raise ProviderError('Unexpected college data response.') from None
            data[label] = rows
        data['historicalAvailabilityVerified'] = False
        self.store.save('cfbd', target, data, self.clock())
        return self.store.latest('cfbd', target)

    def nfl_schedule(self, year):
        if not 2000 <= year <= 2100:
            raise ValueError('Invalid season')
        previous = self.cached('nflverse', str(year), 86400)
        if previous:
            return previous
        self.store.reserve('nflverse', 1, 1, 31, self.clock())
        body, _ = self.transport('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv')
        try:
            rows = list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))))
        except (ValueError, UnicodeError):
            raise ProviderError('Unexpected NFL schedule response.') from None
        if rows and not {'game_id', 'season', 'home_team', 'away_team'}.issubset(rows[0]):
            raise ProviderError('Unexpected NFL schedule columns.')
        data = {'games': [row for row in rows if row['season'] == str(year)], 'source': 'nflverse/nfldata · games.csv', 'historicalAvailabilityVerified': False}
        self.store.save('nflverse', str(year), data, self.clock())
        return self.store.latest('nflverse', str(year))
