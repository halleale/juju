import os
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .providers import quote_status
from .events import slate_events
from .store import Store, utcnow

app = FastAPI(title='juju research', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('RESEARCH_CORS_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081').split(','), allow_methods=['GET'], allow_headers=['Content-Type'])


def store():
    return Store(os.getenv('RESEARCH_DB_PATH', '.data/research.sqlite'))


@app.get('/health')
def health():
    return {'status': 'ok', 'recommendationsEnabled': False}


@app.get('/v1/providers')
def providers():
    db = store()
    return {'monthlyBudgetUsd': 100, 'billingEnforced': False, 'recommendationsEnabled': False, 'providers': [
        {'id': 'odds', 'name': 'The Odds API', 'configured': bool(os.getenv('ODDS_API_KEY')), 'leagues': ['nfl', 'ncaaf'], 'dailyLimit': int(os.getenv('ODDS_DAILY_CREDIT_LIMIT', '30')), 'monthlyLimit': int(os.getenv('ODDS_MONTHLY_CREDIT_LIMIT', '450')), **db.usage('odds', utcnow())},
        {'id': 'cfbd', 'name': 'CollegeFootballData', 'configured': bool(os.getenv('CFBD_API_KEY')), 'leagues': ['ncaaf'], 'dailyLimit': int(os.getenv('CFBD_DAILY_REQUEST_LIMIT', '10')), 'monthlyLimit': int(os.getenv('CFBD_MONTHLY_REQUEST_LIMIT', '50')), **db.usage('cfbd', utcnow())},
        {'id': 'nflverse', 'name': 'nflverse schedules/results', 'configured': True, 'leagues': ['nfl'], 'dailyLimit': 1, 'monthlyLimit': 31, **db.usage('nflverse', utcnow())},
    ]}


@app.get('/v1/slate')
def slate(league: Literal['nfl', 'ncaaf'] = 'nfl'):
    db = store()
    snapshot = db.latest('odds', league)
    if not snapshot:
        return {'league': league, 'status': 'unavailable', 'quotes': [], 'events': [], 'recommendationsEnabled': False, 'message': 'No provider snapshot has been collected. No sample quotes are substituted.'}
    now = utcnow()
    quotes = [{**q, 'status': quote_status(q, now)} for q in snapshot['data']['quotes']]
    events = slate_events(quotes, db.latest_targets('nflverse' if league == 'nfl' else 'cfbd'))
    return {'league': league, 'status': 'available' if quotes else 'empty', 'snapshotId': snapshot['snapshotId'], 'ingestedAt': snapshot['ingestedAt'], 'asOf': now.isoformat(), 'quotes': quotes, 'events': events, 'recommendationsEnabled': False, 'message': 'Provider research only. No validated model probabilities or recommendations.'}


@app.get('/v1/research')
def research(league: Literal['nfl', 'ncaaf'], year: int, week: int = 1):
    snapshot = store().latest('cfbd', f'{year}-{week}') if league == 'ncaaf' else store().latest('nflverse', str(year))
    return {'league': league, 'status': 'available' if snapshot else 'unavailable', 'snapshot': snapshot, 'historicalAvailabilityVerified': False, 'recommendationsEnabled': False}
