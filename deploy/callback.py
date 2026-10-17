"""Construct sign-in URLs only for the actual Azure-provided pilot hostname."""
import json
import re
import sys

def callback_settings(hostname):
    if not re.fullmatch(r'[a-z0-9-]+(?:\.[a-z0-9-]+)*\.azurewebsites\.net', hostname):
        raise ValueError('Unexpected Azure web app hostname; stopped without changing sign-in.')
    return {'spa': {'redirectUris': [f'https://{hostname}/auth-callback.html']}, 'web': {'logoutUrl': f'https://{hostname}/'}}

if __name__ == '__main__':
    try:
        json.dump(callback_settings(sys.argv[1]), sys.stdout)
    except ValueError as error:
        raise SystemExit(str(error))
