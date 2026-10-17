"""Fail closed if ARM proposes deletions, unknown mutations or uncertain changes."""
import json
import sys

def check_preview(report, template, state):
    if report.get('status') not in [None, 'Succeeded']:
        raise ValueError('ARM preview did not succeed.')
    changes = report.get('changes')
    if not isinstance(changes, list):
        raise ValueError('ARM preview changes are missing.')
    prefix = f"/subscriptions/{state['subscription']}/resourceGroups/{state['resourceGroup']}/providers/"
    allowed = set()
    for resource in template['resources']:
        namespace, *types = resource['type'].split('/')
        names = resource['name'].split('/')
        if len(types) != len(names):
            raise ValueError('Unexpected resource-name structure in the approved template.')
        path = '/'.join(f'{kind}/{name}' for kind, name in zip(types, names))
        allowed.add((prefix+namespace+'/'+path).lower())
    for change in changes:
        kind = change.get('changeType')
        if kind in ['NoChange', 'Ignore']:
            continue
        if kind not in ['Create', 'Modify']:
            raise ValueError('ARM preview contains a deletion or an uncertain change; stopped.')
        if str(change.get('resourceId', '')).lower() not in allowed:
            raise ValueError('ARM preview would change a resource outside the approved pilot template; stopped.')

if __name__ == '__main__':
    try:
        check_preview(*(json.load(open(path)) for path in sys.argv[1:]))
    except (ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error))
    print('ARM preview checked: only approved pilot resources, no deletions or uncertain changes.')
