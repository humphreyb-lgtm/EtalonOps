"""Offline activation rehearsal. All Azure/HTTP operations are mocked; no paid calls."""
import contextlib,io,json,pathlib,runpy,subprocess,unittest
from unittest.mock import patch
SCRIPT=pathlib.Path(__file__).with_name('enable-azure-research.py')
class ActivationTest(unittest.TestCase):
 def rehearse(self,bad_price=False,pin_failure=False,web=False):
  subscription='a428f249-9b2a-4314-8619-6b3fd33c805e';state={'subscription':subscription,'tenant':'test-tenant','appName':'etalonops-954bb4a3','resourceGroup':'rg-etalonops-poc'}
  info={'id':'/subscriptions/'+subscription+'/resourceGroups/MaterialsManagement-Azure-Paid/providers/Microsoft.CognitiveServices/accounts/materialsmanagement-openai-paid/deployments/gpt-5.4-mini','sku':{'name':'DataZoneStandard','capacity':100,'family':None,'size':None,'tier':None},'properties':{'model':{'format':'OpenAI','name':'gpt-5.4-mini','version':'2026-03-17','callRateLimit':{'count':100},'publisher':None,'source':None,'sourceAccount':None},'dynamicThrottlingEnabled':None,'versionUpgradeOption':'OnceNewDefaultVersionAvailable','provisioningState':'Succeeded'}}
  calls=[];settings_paths=[]
  def az(args,**_kwargs):
   calls.append(args)
   if args[1:3]==['account','show']:value={'id':subscription,'tenantId':'test-tenant'}
   elif args[1:4]==['cognitiveservices','account','show']:value={'location':'eastus','properties':{'endpoint':'https://materialsmanagement-openai-paid.openai.azure.com/'}}
   elif args[1:5]==['cognitiveservices','account','deployment','show']:value=info
   elif args[1:3]==['rest','--method']:
    body=json.loads(args[args.index('--body')+1]);self.assertEqual(body['sku'],{'name':'DataZoneStandard','capacity':100});self.assertEqual(body['properties']['model'],{'format':'OpenAI','name':'gpt-5.4-mini','version':'2026-03-17'});self.assertNotIn('dynamicThrottlingEnabled',body['properties']);self.assertNotIn('null',json.dumps(body));
    if pin_failure:raise subprocess.CalledProcessError(1,args,stderr='BadRequest: illustrative Azure update rejection')
    info['properties']['versionUpgradeOption']='NoAutoUpgrade';value=info
   elif args[1:5]==['cognitiveservices','account','keys','list']:value={'key1':'fictional-activation-test-key'}
   else:raise AssertionError(args)
   return json.dumps(value)
  def http(url,**_kwargs):
   value={'release':'assisted-research-v18' if web else 'source-research-v16','engine':'Azure SQL'} if '/api/health' in url else {'Items':[{'skuName':name,'retailPrice':price,'unitOfMeasure':'1M','type':'Consumption'} for name,price in [('5.4 mini Inp Dz',9 if bad_price else .825),('5.4 mini Opt Dz',4.95)]],'NextPageLink':None}
   if 'Bing' in url:value={'Items':[{'productName':'Grounding with Bing','skuName':'Search','retailPrice':14,'unitOfMeasure':'1K','type':'Consumption'}],'NextPageLink':None}
   return io.BytesIO(json.dumps(value).encode())
  def run(args,**_kwargs):
   path=pathlib.Path(args[args.index('--settings')+1][1:]);settings_paths.append(path);self.assertEqual(path.stat().st_mode&0o777,0o600);settings=json.loads(path.read_text());self.assertEqual(settings['ETALONOPS_AZURE_OPENAI_API_KEY'],'fictional-activation-test-key');self.assertEqual(settings['ETALONOPS_RESEARCH_BUDGET_USD'],'30');self.assertEqual(settings['ETALONOPS_AI_ENABLED'],'false');self.assertEqual(args[-2:],['--output','none']);self.assertEqual(settings.get('ETALONOPS_RESEARCH_WEB_ENABLED'), 'true' if web else None)
  actual_read=pathlib.Path.read_text
  def read(path,*args,**kwargs):return json.dumps(state) if str(path)=='.runtime/azure-deployment.json' else actual_read(path,*args,**kwargs)
  with patch('sys.argv',['enable-azure-research.py']+(['--enable-web-discovery'] if web else [])),patch('subprocess.check_output',az),patch('subprocess.run',run),patch('urllib.request.urlopen',http),patch('pathlib.Path.read_text',read),contextlib.redirect_stdout(io.StringIO()) as output:
   if pin_failure:
    with self.assertRaisesRegex(SystemExit,'illustrative Azure update rejection'):runpy.run_path(str(SCRIPT),run_name='__main__')
   elif bad_price:
    with self.assertRaisesRegex(SystemExit,'pricing changed'):runpy.run_path(str(SCRIPT),run_name='__main__')
   else:runpy.run_path(str(SCRIPT),run_name='__main__')
  self.assertNotIn('fictional-activation-test-key',output.getvalue());self.assertTrue(all(not path.exists() for path in settings_paths))
  if pin_failure:self.assertFalse(any('keys' in args for args in calls));self.assertEqual(settings_paths,[])
  if bad_price:self.assertFalse(any(args[1]=='rest' or 'keys' in args for args in calls))
 def test_web_discovery_activation_checks_bing_price_and_uses_existing_resource(self):self.rehearse(web=True)
 def test_secure_activation_preserves_model_capacity_and_cleans_key_file(self):self.rehearse()
 def test_azure_pin_error_is_reported_without_key_access_or_activation(self):self.rehearse(pin_failure=True)
 def test_changed_prices_stop_before_changes_or_key_read(self):self.rehearse(bad_price=True)
if __name__=='__main__':unittest.main()
