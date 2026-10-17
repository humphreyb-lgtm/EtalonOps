"""Region checks for the approved pilot; never move or delete existing resources."""
import argparse
import json
from pathlib import Path

REGIONS = {'eastus': 'East US', 'westus3': 'West US 3'}

def select_region(value):
    if value not in REGIONS:
        raise ValueError('Pilot region must be eastus or westus3; other regions need review.')
    return value

def check_inventory(resources, region):
    select_region(region)
    for resource in resources:
        location = str(resource.get('location', '')).lower().replace(' ', '')
        if location not in ['', 'global', region]:
            raise ValueError('Existing POC resources are in another region. Refusing relocation; preserve resources and review the inventory.')

def merge_state(expected, previous, region):
    select_region(region)
    if previous and any(previous.get(k) != v for k, v in expected.items()):
        raise ValueError('Existing deployment state belongs to another account or identity; stopped.')
    state = {**expected, **(previous or {})}
    # A region change is permitted only after the caller checks the live inventory.
    # Resource-group metadata location can differ and is never changed in place.
    state['region'] = region
    return state

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('region')
    parser.add_argument('--inventory')
    args = parser.parse_args()
    try:
        region = select_region(args.region)
        if args.inventory:
            check_inventory(json.loads(Path(args.inventory).read_text()), region)
        print(REGIONS[region])
    except ValueError as error:
        raise SystemExit(str(error))
