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
        self.assertEqual(settings['ETALONOPS_STORAGE_ACCOUNT'],'etalonopstest')
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

    def test_westus3_template_preserves_scope_and_rejects_unreviewed_regions(self):
        state=dict(tenant='t',ownerId='o',ownerLogin='owner@example.invalid',clientId='c',logsName='logs',insightsName='insights',planName='plan',sqlName='sql',storageName='etalonopstest',appName='app',region='westus3')
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'state.json';path.write_text(json.dumps(state))
            template=json.loads(subprocess.check_output(['python3','deploy/template.py',str(path)]))
            self.assertEqual(len(template['resources']),13)
            self.assertTrue(all(r.get('location','westus3')=='westus3' for r in template['resources']))
            plan=next(r for r in template['resources'] if r['type']=='Microsoft.Web/serverfarms')
            self.assertEqual(plan['sku']['name'],'B1');self.assertEqual(plan['sku']['capacity'],1)
            app=next(r for r in template['resources'] if r['type']=='Microsoft.Web/sites')
            self.assertIn({'name':'ETALONOPS_AI_ENABLED','value':'false'},app['properties']['siteConfig']['appSettings'])
            state['region']='unreviewed';path.write_text(json.dumps(state))
            self.assertNotEqual(subprocess.run(['python3','deploy/template.py',str(path)],capture_output=True).returncode,0)

    def test_region_transition_preserves_identity_and_refuses_moving_resources(self):
        from deploy.region import merge_state,check_inventory,select_region
        expected={'subscription':'approved','resourceGroup':'owned','appName':'existing'}
        original={**expected,'region':'eastus','clientId':'existing-client'}
        updated=merge_state(expected,original,'westus3')
        self.assertEqual(updated['clientId'],'existing-client');self.assertEqual(original['region'],'eastus')
        check_inventory([], 'westus3')
        check_inventory([{'location':'West US 3'},{'location':'global'}],'westus3')
        with self.assertRaises(ValueError):check_inventory([{'location':'eastus'}],'westus3')
        with self.assertRaises(ValueError):merge_state(expected,{**original,'subscription':'foreign'},'westus3')
        with self.assertRaises(ValueError):select_region('unreviewed')

    def test_preview_rejects_deletion_unknown_resources_and_unsupported_changes(self):
        from deploy.preview import check_preview
        state={'subscription':'approved','resourceGroup':'owned'}
        template={'resources':[{'type':'Microsoft.Web/serverfarms','name':'pilot'}]}
        resource='/subscriptions/approved/resourceGroups/owned/providers/Microsoft.Web/serverfarms/pilot'
        for kind in ['Create','Modify','NoChange']:
            check_preview({'status':'Succeeded','changes':[{'changeType':kind,'resourceId':resource}]},template,state)
        for kind in ['Delete','Unsupported','Deploy']:
            with self.assertRaises(ValueError):check_preview({'changes':[{'changeType':kind,'resourceId':resource}]},template,state)
        with self.assertRaises(ValueError):check_preview({'changes':[{'changeType':'Modify','resourceId':resource+'-foreign'}]},template,state)
        with self.assertRaises(ValueError):check_preview({},template,state)

    def test_actual_azure_hostname_is_used_without_accepting_foreign_redirects(self):
        from deploy.callback import callback_settings
        self.assertEqual(callback_settings('pilot-hash.westus3-01.azurewebsites.net')['spa']['redirectUris'],['https://pilot-hash.westus3-01.azurewebsites.net/auth-callback.html'])
        for host in ['foreign.example','pilot.azurewebsites.net.evil.example','https://pilot.azurewebsites.net','pilot.azurewebsites.net/path']:
            with self.assertRaises(ValueError):callback_settings(host)

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
        state['appHost']='test-app-hash.westus3-01.azurewebsites.net'
        app['spa']['redirectUris']=['https://test-app-hash.westus3-01.azurewebsites.net/auth-callback.html']
        self.assertEqual(recover(state,[app]),{'id':'object-id','appId':'client-id'})

if __name__=='__main__': unittest.main()
