import argparse
import os

from .providers import ProviderError, Providers
from .store import BudgetExceeded, Store


def main():
    parser = argparse.ArgumentParser(description='Collect shared football research snapshots; keys stay on the server.')
    parser.add_argument('provider', choices=['odds', 'cfbd', 'nflverse'])
    parser.add_argument('--league', choices=['nfl', 'ncaaf'], default='nfl')
    parser.add_argument('--year', type=int)
    parser.add_argument('--week', type=int)
    args = parser.parse_args()
    client = Providers(Store(os.getenv('RESEARCH_DB_PATH', '.data/research.sqlite')))
    try:
        if args.provider == 'odds':
            snapshot = client.odds(args.league)
        elif args.provider == 'cfbd':
            if args.year is None or args.week is None:
                parser.error('cfbd requires --year and --week')
            snapshot = client.college(args.year, args.week)
        else:
            if args.year is None:
                parser.error('nflverse requires --year')
            snapshot = client.nfl_schedule(args.year)
    except (ProviderError, BudgetExceeded, ValueError) as error:
        parser.exit(1, f'{error}\n')
    print(f'Snapshot {snapshot["snapshotId"]} available; keys are not included. Recommendations remain disabled.')


if __name__ == '__main__':
    main()
