import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

class DeploymentScope(unittest.TestCase):
    def test_template_keeps_approved_skus_identity_and_security_limits(self):
        state=dict(tenant='11111111-1111-4111-8111-111111111111',ownerId='22222222-2222-4222-8222-222222222222',ownerLogin='owner@example.invalid',clientId='33333333-3333-4333-8333-333333333333',logsName='test-logs',insightsName='test-insights',planName='test-plan',sqlName='test-sql',storageName='etalonopstest',appName='test-app',identityName='Test pilot')
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'state.json';path.write_text(json.dumps(state))
            template=json.loads(subprocess.check_output(['python3','deploy/template.py',str(path)]))
            manifest=json.loads(subprocess.check_output(['python3','deploy/identity.py',str(path)]))
        resources=template['resources']
        by_type={r['type']:r for r in resources}
        self.assertEqual(len(resources),13)
        # Azure requires one name argument per resource-type segment, including
        # nested SQL databases and Blob services used by dependency expressions.
        import ast
        for resource in resources:
            for expression in resource.get('dependsOn',[]):
                args=ast.literal_eval('['+expression.removeprefix('[resourceId(').removesuffix(')]')+']')
                self.assertEqual(len(args)-1,len(args[0].split('/'))-1,expression)
                self.assertTrue(all('/' not in name for name in args[1:]),expression)
        retention=by_type['Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies']
        self.assertEqual(retention['dependsOn'],["[resourceId('Microsoft.Sql/servers/databases', 'test-sql', 'EtalonOps')]"])
        container=by_type['Microsoft.Storage/storageAccounts/blobServices/containers']
        self.assertEqual(container['dependsOn'],["[resourceId('Microsoft.Storage/storageAccounts/blobServices', 'etalonopstest', 'default')]"])
        self.assertEqual(by_type['Microsoft.Web/serverfarms']['sku']['name'],'B1')
        self.assertEqual(by_type['Microsoft.Web/serverfarms']['sku']['capacity'],1)
        self.assertEqual(by_type['Microsoft.Sql/servers/databases']['sku']['name'],'Basic')
        self.assertTrue(by_type['Microsoft.Sql/servers']['properties']['administrators']['azureADOnlyAuthentication'])
        app=by_type['Microsoft.Web/sites']
        self.assertEqual(app['identity']['type'],'SystemAssigned')
        self.assertTrue(app['properties']['httpsOnly'])
        settings={x['name']:x['value'] for x in app['properties']['siteConfig']['appSettings']}
        self.assertEqual(settings['ETALONOPS_AI_ENABLED'],'false')
        self.assertNotIn('password',json.dumps(template).lower())
        blob=by_type['Microsoft.Storage/storageAccounts']['properties']
        self.assertFalse(blob['allowSharedKeyAccess'])
        self.assertFalse(blob['allowBlobPublicAccess'])
        self.assertEqual(by_type['Microsoft.Consumption/budgets']['properties']['amount'],30)
        self.assertTrue(all(r.get('location','eastus')=='eastus' for r in resources))
        self.assertEqual(manifest['signInAudience'],'AzureADMyOrg')
        self.assertEqual(manifest['api']['requestedAccessTokenVersion'],2)
        self.assertEqual([r['value'] for r in manifest['appRoles']],['Admin','Foreman'])
        self.assertNotIn('passwordCredentials',manifest)
        self.assertNotIn('requiredResourceAccess',manifest)

    def test_runtime_preflight_accepts_current_table_and_legacy_cli_formats(self):
        import shlex
        line=next(line for line in Path('scripts/deploy-cloud.sh').read_text().splitlines() if line.startswith('az webapp list-runtimes '))
        command=shlex.split(line.split(' | ',1)[1])
        for output in ['NODE:24-lts\n', 'Linux\tNode\t24.0 LTS\tNODE|24-lts\tActive\t2028-04-30\n']:
            result=subprocess.run(command,input=output,text=True,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
        for output in ['', 'Linux\tNode\t22.0 LTS\tNODE|22-lts\tNear\n', 'NODE|24-lts-unsupported\n']:
            result=subprocess.run(command,input=output,text=True,capture_output=True)
            self.assertNotEqual(result.returncode,0)

    def test_ephemeral_shell_recovery_requires_exact_pilot_identity(self):
        import copy
        from deploy.recover_identity import recover
        state={'identityName':'Pilot','appName':'test-app'}
        app={'id':'object-id','appId':'client-id','displayName':'Pilot','tags':['EtalonOpsPOC'],'signInAudience':'AzureADMyOrg','spa':{'redirectUris':['https://test-app.azurewebsites.net/auth-callback.html']},'appRoles':[{'id':i,'value':v,'isEnabled':True,'allowedMemberTypes':['User']} for i,v in [('9c6c4e1a-3830-4400-9b69-ce15aa8a0bdd','Admin'),('49dbde60-3bed-4ec8-9c21-3d6c8dc355a8','Foreman')]],'api':{'requestedAccessTokenVersion':2,'oauth2PermissionScopes':[{'id':'895f3efb-fef1-4b7c-840e-50ad2e0ee2cc','value':'access_as_user','isEnabled':True}]}}
        self.assertEqual(recover(state,[app]),{'id':'object-id','appId':'client-id'})
        for key,value in [('tags',[]),('signInAudience','AzureADMultipleOrgs'),('passwordCredentials',[{'keyId':'unexpected'}]),('requiredResourceAccess',[{}]),('spa',{'redirectUris':['https://foreign.invalid']})]:
            bad=copy.deepcopy(app);bad[key]=value
            with self.assertRaises(ValueError): recover(state,[bad])
        with self.assertRaises(ValueError): recover(state,[app,app])

if __name__=='__main__': unittest.main()
