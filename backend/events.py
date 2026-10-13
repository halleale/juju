"""Conservative schedule reconciliation; no fuzzy matching or inferred evidence."""
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .providers import timestamp

COLLEGE_TEAMS = json.loads(Path(__file__).with_name('college_teams.json').read_text())
NFL_TEAMS = dict(zip([
    'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
    'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
    'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
    'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
    'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
    'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
    'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
    'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
], 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LV LAC LA MIA MIN NE NO NYG NYJ PHI PIT SF SEA TB TEN WAS'.split()))


def nfl_kickoff(game):
    try:
        # nflverse gameday/gametime are US Eastern, including daylight saving time.
        return datetime.fromisoformat(f"{game['gameday']}T{game['gametime']}").replace(tzinfo=ZoneInfo('America/New_York')).astimezone(timezone.utc)
    except (ValueError, KeyError, TypeError):
        return None


def match_schedule(event, snapshots):
    league = event['league']
    aliases = NFL_TEAMS if league == 'nfl' else COLLEGE_TEAMS
    home, away = aliases.get(event['home']), aliases.get(event['away'])
    kickoff = timestamp(event['kickoff'])
    missing = {'status': 'unmatched', 'message': 'No unambiguous schedule match. No research is attached.'}
    if not home or not away or not kickoff:
        return missing
    matches = []
    for snapshot in snapshots.values():
        for game in snapshot['data'].get('games', []):
            if league == 'nfl':
                teams = (game.get('home_team'), game.get('away_team'))
                scheduled = nfl_kickoff(game)
                source_id = game.get('game_id')
            else:
                teams = (game.get('homeTeam'), game.get('awayTeam'))
                scheduled = None if game.get('startTimeTBD') else timestamp(game.get('startDate'))
                source_id = game.get('id')
            # Exact mapped teams, home/away orientation, and a five-minute time tolerance.
            if source_id and teams == (home, away) and scheduled and abs((scheduled - kickoff).total_seconds()) <= 300:
                matches.append((snapshot, game, scheduled, source_id))
    if len(matches) != 1:
        return {**missing, 'status': 'ambiguous' if len(matches) > 1 else 'unmatched'}
    snapshot, game, scheduled, source_id = matches[0]
    result = {'status': 'matched', 'provider': 'nflverse' if league == 'nfl' else 'CollegeFootballData',
              'sourceEventId': str(source_id), 'snapshotId': snapshot['snapshotId'],
              'ingestedAt': snapshot['ingestedAt'], 'scheduledKickoff': scheduled.isoformat(),
              'week': game.get('week'), 'venue': game.get('stadium') if league == 'nfl' else game.get('venue'),
              'historicalAvailabilityVerified': False, 'matchRule': 'exact_team_aliases_and_kickoff_within_5_minutes'}
    if league == 'ncaaf':
        result['fbsMatchup'] = game.get('homeClassification') == 'fbs' and game.get('awayClassification') == 'fbs'
        # Advanced stats are postgame records, never implicitly pregame model inputs.
        records = [r for r in snapshot['data'].get('advancedStats', []) if str(r.get('gameId', r.get('game_id'))) == str(source_id)]
        result['advancedStatsStatus'] = 'available_postgame_only' if records else 'unavailable'
    return result


def slate_events(quotes, snapshots):
    unique = {q['eventId']: q for q in quotes}
    return [{**{key: q[key] for key in ('eventId', 'league', 'home', 'away', 'kickoff')},
             'schedule': match_schedule(q, snapshots)} for q in unique.values()]
