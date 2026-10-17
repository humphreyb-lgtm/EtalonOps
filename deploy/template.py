"""Generate the narrowly scoped ARM template; reads/writes no credentials."""
import datetime
import json
import sys

state = json.load(open(sys.argv[1]))
resources = []
def add(resource_type, api, name, properties=None, **extra):
    r = dict(type=resource_type, apiVersion=api, name=name, **extra)
    if properties is not None:
        r['properties'] = properties
    resources.append(r)
    return "[resourceId(" + ", ".join(repr(v) for v in [resource_type, *name.split("/")]) + ")]"
loc = 'eastus'
logs = add('Microsoft.OperationalInsights/workspaces', '2023-09-01', state['logsName'], {'sku': {'name': 'PerGB2018'}, 'retentionInDays': 30, 'workspaceCapping': {'dailyQuotaGb': 0.1}, 'features': {'enableLogAccessUsingOnlyResourcePermissions': True}}, location=loc)
insights = add('Microsoft.Insights/components', '2020-02-02', state['insightsName'], {'Application_Type': 'web', 'WorkspaceResourceId': logs}, location=loc, kind='web', dependsOn=[logs])
plan = add('Microsoft.Web/serverfarms', '2023-12-01', state['planName'], {'reserved': True}, location=loc, kind='linux', sku={'name': 'B1', 'tier': 'Basic', 'size': 'B1', 'capacity': 1})
sql_server = add('Microsoft.Sql/servers', '2023-08-01', state['sqlName'], {'version': '12.0', 'minimalTlsVersion': '1.2', 'publicNetworkAccess': 'Enabled', 'administrators': {'administratorType': 'ActiveDirectory', 'principalType': 'User', 'login': state['ownerLogin'], 'sid': state['ownerId'], 'tenantId': state['tenant'], 'azureADOnlyAuthentication': True}}, location=loc)
db = add('Microsoft.Sql/servers/databases', '2023-08-01', state['sqlName']+'/EtalonOps', {'maxSizeBytes': 2147483648, 'requestedBackupStorageRedundancy': 'Local'}, location=loc, sku={'name': 'Basic', 'tier': 'Basic', 'capacity': 5}, dependsOn=[sql_server])
add('Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies', '2023-08-01', state['sqlName']+'/EtalonOps/default', {'retentionDays': 7}, dependsOn=[db])
blob = add('Microsoft.Storage/storageAccounts', '2023-05-01', state['storageName'], {'minimumTlsVersion': 'TLS1_2', 'supportsHttpsTrafficOnly': True, 'allowBlobPublicAccess': False, 'allowSharedKeyAccess': False, 'defaultToOAuthAuthentication': True, 'accessTier': 'Hot'}, location=loc, kind='StorageV2', sku={'name': 'Standard_LRS'})
blobsvc = add('Microsoft.Storage/storageAccounts/blobServices', '2023-05-01', state['storageName']+'/default', {'deleteRetentionPolicy': {'enabled': True, 'days': 7}, 'containerDeleteRetentionPolicy': {'enabled': True, 'days': 7}, 'isVersioningEnabled': True}, dependsOn=[blob])
add('Microsoft.Storage/storageAccounts/blobServices/containers', '2023-05-01', state['storageName']+'/default/catalog-images', {'publicAccess': 'None'}, dependsOn=[blobsvc])
settings = {'ETALONOPS_STORAGE_ACCOUNT': state['storageName'], 'ETALONOPS_AUTH_MODE': 'entra', 'ETALONOPS_TENANT_ID': state['tenant'], 'ETALONOPS_CLIENT_ID': state['clientId'], 'ETALONOPS_SQL_HOST': state['sqlName']+'.database.windows.net', 'ETALONOPS_AI_ENABLED': 'false', 'NODE_ENV': 'production', 'SCM_DO_BUILD_DURING_DEPLOYMENT': 'false', 'WEBSITE_RUN_FROM_PACKAGE': '1', 'WEBSITES_PORT': '8080', 'APPLICATIONINSIGHTS_CONNECTION_STRING': f"[reference(resourceId('Microsoft.Insights/components','{state['insightsName']}'),'2020-02-02').ConnectionString]"}
app = add('Microsoft.Web/sites', '2023-12-01', state['appName'], {'serverFarmId': plan, 'httpsOnly': True, 'clientAffinityEnabled': False, 'siteConfig': {'linuxFxVersion': 'NODE|24-lts', 'appCommandLine': 'npm start', 'alwaysOn': True, 'ftpsState': 'Disabled', 'minTlsVersion': '1.2', 'scmMinTlsVersion': '1.2', 'http20Enabled': True, 'healthCheckPath': '/api/health', 'appSettings': [{'name': k, 'value': v} for k, v in settings.items()]}}, location=loc, kind='app,linux', identity={'type': 'SystemAssigned'}, dependsOn=[plan, insights, db])
for endpoint in ['ftp', 'scm']:
    add('Microsoft.Web/sites/basicPublishingCredentialsPolicies', '2023-12-01', state['appName']+'/'+endpoint, {'allow': False}, dependsOn=[app])
# Notifications only. This budget is not an enforced spending cap.
start = datetime.date.today().replace(day=1).isoformat()+'T00:00:00Z'
add('Microsoft.Consumption/budgets', '2023-11-01', 'EtalonOps-pilot-monthly', {'category': 'Cost', 'amount': 30, 'timeGrain': 'Monthly', 'timePeriod': {'startDate': start, 'endDate': '2035-01-01T00:00:00Z'}, 'notifications': {f'Actual{n}': {'enabled': True, 'operator': 'GreaterThanOrEqualTo', 'threshold': n, 'thresholdType': 'Actual', 'contactRoles': ['Owner']} for n in [50,80,100]}})
json.dump({'$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#', 'contentVersion': '1.0.0.0', 'resources': resources}, sys.stdout, indent=2)
