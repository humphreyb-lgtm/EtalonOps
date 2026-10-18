"""Enable the existing pilot's bounded manufacturer-page research. No new resources.
Run only after installing the v16 application update in authenticated Cloud Shell.
Keys are read directly from Azure into a private temporary settings file, never printed.
"""
from datetime import datetime, timezone
import json, os, pathlib, subprocess, tempfile, urllib.request, urllib.parse

def az(*args):
    return json.loads(subprocess.check_output(['az',*args,'--output','json'],text=True))

def require(condition,message):
    if not condition: raise SystemExit(message)

require(datetime.now(timezone.utc).date().isoformat()<='2026-11-18','Research pricing policy needs rechecking before activation.')
os.umask(0o077)
state=json.loads(pathlib.Path('.runtime/azure-deployment.json').read_text())
subscription='a428f249-9b2a-4314-8619-6b3fd33c805e'
account=az('account','show')
require(account['id']==state['subscription']==subscription and account['tenantId']==state['tenant'],'Wrong Azure account or subscription. Stopped.')
require(state['appName']=='etalonops-954bb4a3' and state['resourceGroup']=='rg-etalonops-poc','Unexpected application. Stopped.')
resource='materialsmanagement-openai-paid'; group='MaterialsManagement-Azure-Paid'; deployment='gpt-5.4-mini'
resource_info=az('cognitiveservices','account','show','--name',resource,'--resource-group',group)
endpoint=resource_info['properties']['endpoint']
require(endpoint.rstrip('/')=='https://materialsmanagement-openai-paid.openai.azure.com' and resource_info['location']=='eastus','Unexpected existing AI resource. Stopped.')
info=az('cognitiveservices','account','deployment','show','--name',resource,'--resource-group',group,'--deployment-name',deployment)
model=info['properties']['model']
require(model['name']=='gpt-5.4-mini' and model['version']=='2026-03-17' and info['sku']['name']=='DataZoneStandard','Unexpected model, version or deployment type. No settings changed.')
require(info['properties'].get('provisioningState')=='Succeeded','Model deployment is not ready.')
with urllib.request.urlopen('https://etalonops-954bb4a3.azurewebsites.net/api/health',timeout=30) as response: health=json.load(response)
require(health.get('release')=='source-research-v16' and health.get('engine')=='Azure SQL','Install the v16 update successfully before enabling research.')
# Verify current public retail rates before changing the AI deployment or application.
query=urllib.parse.urlencode({'$filter':"contains(meterName, '5.4') and armRegionName eq 'eastus'"})
with urllib.request.urlopen('https://prices.azure.com/api/retail/prices?'+query,timeout=30) as response: prices=json.load(response)
require(not prices.get('NextPageLink'),'Price query was incomplete. Stop for pricing review.')
for sku,expected in [('5.4 mini Inp Dz',0.825),('5.4 mini Opt Dz',4.95)]:
    matches=[item for item in prices['Items'] if item.get('skuName')==sku and item.get('unitOfMeasure')=='1M' and item.get('type')=='Consumption']
    require(len(matches)==1 and matches[0]['retailPrice']==expected,'Model retail pricing changed or is ambiguous. Stop for budget-policy review.')
# Pin the existing deployment to the already-approved model/version; preserve its SKU/capacity.
if info['properties'].get('versionUpgradeOption')!='NoAutoUpgrade':
    properties={'model':model,'versionUpgradeOption':'NoAutoUpgrade'}
    for key in ['raiPolicyName','dynamicThrottlingEnabled']:
        if key in info['properties']: properties[key]=info['properties'][key]
    body={'sku':info['sku'],'properties':properties}
    az('rest','--method','put','--url','https://management.azure.com'+info['id']+'?api-version=2024-10-01','--body',json.dumps(body))
    pinned=az('cognitiveservices','account','deployment','show','--name',resource,'--resource-group',group,'--deployment-name',deployment)
    require(pinned['properties'].get('provisioningState')=='Succeeded','Model pinning is still in progress. Wait a minute and rerun activation; no application settings changed.')
    require(pinned['properties']['model']==model and pinned['sku']==info['sku'] and pinned['properties']['versionUpgradeOption']=='NoAutoUpgrade','Model pinning is not yet confirmed. No application activation performed.')
keys=az('cognitiveservices','account','keys','list','--name',resource,'--resource-group',group)
settings={'ETALONOPS_RESEARCH_ENABLED':'true','ETALONOPS_OPENAI_ENDPOINT':endpoint,'ETALONOPS_OPENAI_DEPLOYMENT':deployment,'ETALONOPS_AZURE_OPENAI_API_KEY':keys['key1'],'ETALONOPS_RESEARCH_BUDGET_USD':'30','ETALONOPS_RESEARCH_PRICING':'gpt-5.4-mini-2026-03-17-us-dz-2026-10-18','ETALONOPS_AI_ENABLED':'false'}
with tempfile.TemporaryDirectory(prefix='etalonops-ai-settings-') as directory:
    path=pathlib.Path(directory)/'settings.json';path.write_text(json.dumps(settings));path.chmod(0o600)
    subprocess.run(['az','webapp','config','appsettings','set','--resource-group',state['resourceGroup'],'--name',state['appName'],'--settings','@'+str(path),'--output','none'],check=True)
print('Existing Azure model pinned; manufacturer-page research enabled with $30/month conservative reservations. No new resource or paid test request created.')
print('Allow the app to restart, then refresh EtalonOps. General web search remains disabled.')
