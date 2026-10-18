"""No credentials: verify cloud health and anonymous API denial."""
import json
import sys
import time
import urllib.error
import urllib.request
url=sys.argv[1]
for attempt in range(24):
    try:
        with urllib.request.urlopen(url+'/api/health',timeout=20) as response: health=json.load(response)
        if health.get('engine')!='Azure SQL' or health.get('microsoftSignIn') is not True or health.get('release')!='publication-entry-v15': raise ValueError('Unexpected health response')
        break
    except (urllib.error.URLError,TimeoutError,ValueError):
        if attempt==23: raise SystemExit('Cloud health did not become ready. Inspect POC app logs; do not disable authentication/TLS.')
        time.sleep(5)
for path in ['/api/me','/api/projects/riverside/draft','/api/dev/session']:
    try:
        request=urllib.request.Request(url+path,method='POST' if path.endswith('/session') else 'GET')
        urllib.request.urlopen(request,timeout=20)
        raise SystemExit('Anonymous API request was unexpectedly allowed.')
    except urllib.error.HTTPError as error:
        if error.code not in [401,404]: raise
with urllib.request.urlopen(url,timeout=20) as response:
    if b'runtime-config.js' not in response.read(): raise SystemExit('Cloud runtime configuration missing.')
print('Pilot publication-entry-v15 release, Azure SQL health and anonymous API denial verified. Real Microsoft sign-in and owner-isolation acceptance remain to be checked.')
