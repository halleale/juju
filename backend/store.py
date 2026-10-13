import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


class BudgetExceeded(Exception):
    pass


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY, provider TEXT NOT NULL, at TEXT NOT NULL, credits INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, provider TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        try:
            with db:
                yield db
        finally:
            db.close()

    def reserve(self, provider, credits, daily_limit, monthly_limit, now):
        if credits <= 0 or daily_limit < 0 or monthly_limit < 0:
            raise ValueError('Invalid credit budget')
        at = now.astimezone(timezone.utc).isoformat()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            daily = db.execute('SELECT COALESCE(SUM(credits),0) FROM usage WHERE provider=? AND substr(at,1,10)=?', (provider, at[:10])).fetchone()[0]
            monthly = db.execute('SELECT COALESCE(SUM(credits),0) FROM usage WHERE provider=? AND substr(at,1,7)=?', (provider, at[:7])).fetchone()[0]
            if daily + credits > daily_limit or monthly + credits > monthly_limit:
                raise BudgetExceeded('Provider usage cap reached; no request was sent.')
            row = db.execute('INSERT INTO usage(provider,at,credits) VALUES(?,?,?)', (provider, at, credits))
            return row.lastrowid

    def reconcile(self, reservation, actual):
        # Never refund ambiguous failures or unexpectedly smaller reported usage.
        with self.connect() as db:
            db.execute('UPDATE usage SET credits=MAX(credits,?) WHERE id=?', (actual, reservation))

    def usage(self, provider, now):
        at = now.astimezone(timezone.utc).isoformat()
        with self.connect() as db:
            day = db.execute('SELECT COALESCE(SUM(credits),0) FROM usage WHERE provider=? AND substr(at,1,10)=?', (provider, at[:10])).fetchone()[0]
            month = db.execute('SELECT COALESCE(SUM(credits),0) FROM usage WHERE provider=? AND substr(at,1,7)=?', (provider, at[:7])).fetchone()[0]
        return {'dailyReservedCredits': day, 'monthlyReservedCredits': month}

    def save(self, provider, target, data, now):
        with self.connect() as db:
            db.execute('INSERT INTO snapshots(provider,target,at,body) VALUES(?,?,?,?)', (provider, target, now.isoformat(), json.dumps(data)))

    def latest(self, provider, target=None):
        with self.connect() as db:
            row = db.execute('SELECT id,at,body FROM snapshots WHERE provider=? ORDER BY id DESC LIMIT 1', (provider,)).fetchone() if target is None else db.execute('SELECT id,at,body FROM snapshots WHERE provider=? AND target=? ORDER BY id DESC LIMIT 1', (provider, target)).fetchone()
        return {'snapshotId': row[0], 'ingestedAt': row[1], 'data': json.loads(row[2])} if row else None


def utcnow():
    return datetime.now(timezone.utc)
