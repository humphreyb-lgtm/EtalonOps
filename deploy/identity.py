"""Non-secret Entra application manifest for one tenant and one pilot owner."""
import json
import sys
s=json.load(open(sys.argv[1]))
admin='9c6c4e1a-3830-4400-9b69-ce15aa8a0bdd'
foreman='49dbde60-3bed-4ec8-9c21-3d6c8dc355a8'
scope='895f3efb-fef1-4b7c-840e-50ad2e0ee2cc'
body={'displayName': s['identityName'], 'signInAudience':'AzureADMyOrg', 'tags':['EtalonOpsPOC'], 'spa':{'redirectUris':[f"https://{s['appName']}.azurewebsites.net/auth-callback.html"]}, 'web':{'logoutUrl':f"https://{s['appName']}.azurewebsites.net/"}, 'appRoles': [{'allowedMemberTypes':['User'],'description':label+' role in the EtalonOps pilot only.','displayName':label,'id':oid,'isEnabled':True,'value':label} for label,oid in [('Admin',admin),('Foreman',foreman)]], 'api':{'requestedAccessTokenVersion':2,'oauth2PermissionScopes':[{'adminConsentDescription':'Use the EtalonOps pilot as the signed-in user.','adminConsentDisplayName':'Access EtalonOps','id':scope,'isEnabled':True,'type':'User','userConsentDescription':'Use EtalonOps with your assigned application role.','userConsentDisplayName':'Access EtalonOps','value':'access_as_user'}]}}
json.dump(body,sys.stdout,indent=2)
