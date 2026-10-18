"""Verify a complete JSON Lines catalog export without loading it into memory."""
import hashlib
import json
import sys


def verify(path):
    checksum = hashlib.sha256()
    manifest = None
    counts = {}
    total = 0
    complete = False
    with open(path, 'rb') as source:
        while True:
            raw = source.readline(8_000_001)
            if not raw:
                break
            if len(raw) > 8_000_000:
                raise ValueError('Export record exceeds 8 MB.')
            if complete or not raw.endswith(b'\n'):
                raise ValueError('Truncated export or content after its footer.')
            value = json.loads(raw)
            if not isinstance(value, dict):
                raise ValueError('Export lines must contain objects.')
            if manifest is None:
                if value.get('type') != 'manifest' or value.get('format') != 'etalonops-catalog-stream' or value.get('version') != 1:
                    raise ValueError('Unsupported export format.')
                manifest = value
                if not isinstance(value.get('tenant'), str) or not isinstance(value.get('tables'), list) or not all(isinstance(table, str) for table in value['tables']):
                    raise ValueError('Invalid export manifest.')
                counts = dict.fromkeys(value['tables'], 0)
                if len(counts) != len(value['tables']):
                    raise ValueError('Repeated table in manifest.')
            elif value.get('type') == 'record':
                if value['table'] not in counts or value['row'].get('tenant') != manifest['tenant']:
                    raise ValueError('Unexpected table or tenant.')
                counts[value['table']] += 1
                total += 1
            elif value.get('type') == 'complete':
                if value.get('recordCount') != total or value.get('tableCounts') != counts or value.get('sha256') != checksum.hexdigest():
                    raise ValueError('Export count or SHA-256 mismatch.')
                complete = True
                continue
            else:
                raise ValueError('Unknown export record.')
            checksum.update(raw)
    if not complete:
        raise ValueError('Export completion footer missing.')
    return total


if __name__ == '__main__':
    try:
        print(f'Catalog export verified: {verify(sys.argv[1])} records.')
    except (ValueError, KeyError, OSError, IndexError, TypeError, AttributeError) as error:
        raise SystemExit(f'Export verification failed: {error}')
