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

if __name__=='__main__': unittest.main()
