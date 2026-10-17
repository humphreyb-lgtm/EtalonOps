"""Recover only the exact marked pilot identity after ephemeral Cloud Shell loss."""
import json
import sys

def recover(state, candidates):
    if len(candidates) != 1:
        raise ValueError('Expected exactly one matching pilot identity; refusing to guess.')
    app = candidates[0]
    expected_redirect = f"https://{state['appName']}.azurewebsites.net/auth-callback.html"
    roles = {(r['id'],r['value']) for r in app.get('appRoles',[]) if r.get('isEnabled') and r.get('allowedMemberTypes') == ['User']}
    required_roles = {('9c6c4e1a-3830-4400-9b69-ce15aa8a0bdd','Admin'),('49dbde60-3bed-4ec8-9c21-3d6c8dc355a8','Foreman')}
    scopes = app.get('api',{}).get('oauth2PermissionScopes',[])
    conditions = [
        app.get('displayName') == state['identityName'],
        'EtalonOpsPOC' in app.get('tags',[]),
        app.get('signInAudience') == 'AzureADMyOrg',
        app.get('spa',{}).get('redirectUris') == [expected_redirect],
        app.get('api',{}).get('requestedAccessTokenVersion') == 2,
        roles == required_roles and len(app.get('appRoles',[])) == 2,
        len(scopes) == 1 and scopes[0].get('id') == '895f3efb-fef1-4b7c-840e-50ad2e0ee2cc' and scopes[0].get('value') == 'access_as_user' and scopes[0].get('isEnabled') is True,
        not app.get('passwordCredentials') and not app.get('keyCredentials') and not app.get('requiredResourceAccess'),
        app.get('identifierUris',[]) in [[],[f"api://{app.get('appId')}"]],
    ]
    if not all(conditions):
        raise ValueError('Existing identity does not match the exact pilot manifest. No identity was adopted or overwritten.')
    return {'id': app['id'], 'appId': app['appId']}

if __name__ == '__main__':
    try:
        result = recover(json.load(open(sys.argv[1])),json.load(open(sys.argv[2])))
    except (ValueError,KeyError) as error:
        raise SystemExit(str(error))
    json.dump(result,sys.stdout)
