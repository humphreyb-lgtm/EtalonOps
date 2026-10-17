"""Exercise shell control flow with fake Azure/npm commands, never live Azure."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class RegionRunner(unittest.TestCase):
    def exercise(self, foreign_resource=False):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            (root/'scripts').mkdir();(root/'deploy').mkdir();(root/'.runtime').mkdir();(root/'bin').mkdir()
            for file in ['scripts/deploy-cloud.sh','scripts/node-cloud.sh','deploy/template.py','deploy/region.py','deploy/preview.py','deploy/callback.py']:
                shutil.copy(file,root/file)
            subscription='a428f249-9b2a-4314-8619-6b3fd33c805e'
            suffix=hashlib.sha256(subscription.encode()).hexdigest()[:8];prefix='etalonops-'+suffix
            state=dict(subscription=subscription,tenant='tenant',ownerId='owner',ownerLogin='owner@example.invalid',resourceGroup='rg-etalonops-poc',appName=prefix,planName=prefix+'-plan',sqlName=prefix+'-sql',storageName='etalonops'+suffix,logsName=prefix+'-logs',insightsName=prefix+'-insights',identityName='EtalonOps POC '+suffix,clientId='existing-client',applicationObjectId='existing-object',region='eastus')
            (root/'.runtime/azure-deployment.json').write_text(json.dumps(state))
            fake='''import json,os,sys
from pathlib import Path
a=sys.argv[1:]
with open(os.environ['ETALONOPS_TEST_LOG'],'a') as f:f.write(json.dumps(a)+'\\n')
if a[:2]==['account','show']:print(json.dumps({'id':'a428f249-9b2a-4314-8619-6b3fd33c805e','name':'Azure Standard','state':'Enabled','tenantId':'tenant'}))
elif a[:3]==['ad','signed-in-user','show']:print(json.dumps({'id':'owner','userPrincipalName':'owner@example.invalid'}))
elif a[:2]==['group','exists']:print('true')
elif a[:2]==['group','show']:
 if '--query' in a:print('poc')
 else:print(json.dumps({'tags':{'etalonops':'poc'},'location':'eastus'}))
elif a[:2]==['resource','list']:print(json.dumps([{'location':'eastus'}] if os.environ.get('ETALONOPS_TEST_FOREIGN') else []))
elif a[:2]==['webapp','list-runtimes']:print('Linux\\tNode\\t24.0 LTS\\tNODE|24-lts\\tActive')
elif a[:2]==['appservice','list-locations']:print(json.dumps([{'name':'West US 3'}]))
elif a[:3]==['ad','sp','list']:print('existing-sp')
elif a[:1]==['rest']:
 if a[a.index('--method')+1]=='GET':print('1')
elif a[:3]==['deployment','group','validate']:pass
elif a[:3]==['deployment','group','what-if']:print(json.dumps({'status':'Succeeded','changes':[{'changeType':'Unsupported','resourceId':'unknown'}]}))
else:raise SystemExit('Unexpected Azure call in simulation: '+str(a))
'''
            az=root/'bin/az';az.write_text(f'#!{sys.executable}\n'+fake);az.chmod(0o755)
            npm=root/'bin/npm';npm.write_text('#!/usr/bin/env bash\nexit 0\n');npm.chmod(0o755)
            env={**os.environ,'PATH':str(root/'bin')+os.pathsep+os.environ['PATH'],'ETALONOPS_TEST_LOG':str(root/'calls.jsonl'),'ETALONOPS_NODE_REFRESH':'0'}
            if foreign_resource:env['ETALONOPS_TEST_FOREIGN']='1'
            result=subprocess.run(['bash','scripts/deploy-cloud.sh','westus3'],cwd=root,env=env,capture_output=True,text=True,timeout=20)
            self.assertNotEqual(result.returncode,0)
            calls=[json.loads(line) for line in (root/'calls.jsonl').read_text().splitlines()]
            self.assertFalse(any(call[:2]==['group','create'] for call in calls),'Existing East US group metadata must be preserved.')
            self.assertFalse(any(call[:3]==['deployment','group','create'] for call in calls),'Unsafe preview must never proceed to provisioning.')
            if foreign_resource:
                self.assertIn('Refusing relocation',result.stderr)
                self.assertFalse(any(call[:1]==['rest'] for call in calls),'Stop before changing Graph when inventory conflicts.')
            else:
                self.assertIn('uncertain change',result.stderr)
                self.assertTrue(any(call[:3]==['deployment','group','validate'] for call in calls))
                resources=json.loads((root/'.runtime/azure-template.json').read_text())['resources']
                self.assertTrue(all(r.get('location','westus3')=='westus3' for r in resources))
                updated=json.loads((root/'.runtime/azure-deployment.json').read_text())
                self.assertEqual(updated['clientId'],'existing-client')
                self.assertEqual(updated['region'],'westus3')

    def test_region_switch_keeps_identity_and_stops_at_unsafe_preview(self):self.exercise()
    def test_existing_other_region_resources_stop_before_mutation(self):self.exercise(True)

if __name__=='__main__':unittest.main()
