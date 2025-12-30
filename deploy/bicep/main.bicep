// Logic Apps AI Assistant - Cloud Deployment (Security Hardened)
// 
// Security features:
// - User-Assigned Managed Identity for all Azure access
// - Storage: No public blob access, TLS 1.2 minimum, HTTPS only
// - Function App: HTTPS only, TLS 1.2, FTPS disabled
// - All secrets via Managed Identity where possible
//
// Note: Azure Functions still requires storage connection strings for 
// AzureWebJobsStorage. Using MI-based storage access requires additional
// configuration and is not yet fully supported for all scenarios.
//
// Usage:
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file main.bicep \
//     --parameters prefix=myprefix

targetScope = 'resourceGroup'

@description('Prefix for all resource names (3-10 lowercase alphanumeric). If empty, auto-generates one.')
@minLength(0)
@maxLength(10)
param prefix string = ''

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Azure AI Foundry endpoint URL (optional - configure later if not available)')
param aiFoundryEndpoint string = ''

@description('Azure AI Foundry deployment name (e.g., gpt-4o)')
param aiFoundryDeployment string = 'gpt-4o'

// Generate a unique prefix if not provided (uses first 8 chars of unique string)
var effectivePrefix = empty(prefix) ? toLower(take(uniqueString(resourceGroup().id), 8)) : toLower(prefix)
var baseName = 'la-${effectivePrefix}'

// ============================================================================
// User-Assigned Managed Identity
// ============================================================================

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-identity'
  location: location
}

// ============================================================================
// Storage Account (Security Hardened)
// ============================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: replace('${baseName}stor', '-', '')
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true  // Required for Azure Functions AzureWebJobsStorage
    publicNetworkAccess: 'Enabled'  // Required for Functions to access storage
    networkAcls: {
      defaultAction: 'Allow'  // Functions need access; use VNet integration for stricter control
      bypass: 'AzureServices'
    }
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
        table: {
          enabled: true
        }
        queue: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// Storage Blob Data Owner role for Managed Identity (for future MI-based access)
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, storageBlobDataOwnerRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Application Insights (for telemetry and debugging)
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${baseName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${baseName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// App Service Plan (Elastic Premium for Function App)
// ============================================================================

resource functionAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${baseName}-mcp-plan'
  location: location
  sku: {
    tier: 'ElasticPremium'
    name: 'EP1'
  }
  kind: 'elastic'
  properties: {
    maximumElasticWorkerCount: 20
  }
}

// ============================================================================
// Function App (MCP Server) - Security Hardened
// ============================================================================

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${baseName}-mcp'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: functionAppPlan.id
    httpsOnly: true
    clientCertEnabled: false
    siteConfig: {
      nodeVersion: '~20'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        // Storage connection (still requires key for AzureWebJobsStorage)
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: '${baseName}-mcp-content'
        }
        // Runtime settings
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        // Telemetry
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        // Managed Identity for Azure API calls
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentity.properties.clientId
        }
        // Security: Run from package
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }
  }
}

// Function App web config for additional security
resource functionAppWebConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'web'
  properties: {
    minTlsVersion: '1.2'
    ftpsState: 'Disabled'
    http20Enabled: true
    remoteDebuggingEnabled: false
    scmMinTlsVersion: '1.2'
  }
}

// ============================================================================
// Logic App Standard (Agent Loop Host) - Security Hardened
// ============================================================================

resource logicAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${baseName}-agent-plan'
  location: location
  sku: {
    tier: 'WorkflowStandard'
    name: 'WS1'
  }
  kind: 'elastic'
  properties: {
    maximumElasticWorkerCount: 20
  }
}

resource logicApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${baseName}-agent'
  location: location
  kind: 'functionapp,workflowapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: logicAppPlan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: '${baseName}-agent-content'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'APP_KIND'
          value: 'workflowapp'
        }
        {
          name: 'AzureFunctionsJobHost__extensionBundle__id'
          value: 'Microsoft.Azure.Functions.ExtensionBundle.Workflows'
        }
        {
          name: 'AzureFunctionsJobHost__extensionBundle__version'
          value: '[1.*, 2.0.0)'
        }
        // MCP Server configuration
        {
          name: 'MCP_SERVER_URL'
          value: 'https://${functionApp.properties.defaultHostName}'
        }
        {
          name: 'MCP_SERVER_AUDIENCE'
          value: 'api://${baseName}-mcp'
        }
        // Managed Identity for calling MCP server
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentity.properties.clientId
        }
        // AI Foundry configuration (optional)
        {
          name: 'AI_FOUNDRY_ENDPOINT'
          value: aiFoundryEndpoint
        }
        {
          name: 'AI_FOUNDRY_DEPLOYMENT'
          value: aiFoundryDeployment
        }
        // Telemetry
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}

// Logic App web config for additional security
resource logicAppWebConfig 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: logicApp
  name: 'web'
  properties: {
    minTlsVersion: '1.2'
    ftpsState: 'Disabled'
    http20Enabled: true
    remoteDebuggingEnabled: false
    scmMinTlsVersion: '1.2'
  }
}

// ============================================================================
// Role Assignments for Managed Identity
// ============================================================================

// Logic App Contributor role at subscription level (to manage Logic Apps)
var logicAppContributorRoleId = '87a39d53-fc1b-424a-814c-f7e04687dc9e'

resource roleAssignmentLogicApps 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, managedIdentity.id, logicAppContributorRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', logicAppContributorRoleId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Reader role for listing resources
var readerRoleId = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'

resource roleAssignmentReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, managedIdentity.id, readerRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', readerRoleId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// Outputs
// ============================================================================

output prefix string = effectivePrefix
output baseName string = baseName

output managedIdentityId string = managedIdentity.id
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
output managedIdentityClientId string = managedIdentity.properties.clientId

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output functionAppResourceId string = functionApp.id

output logicAppName string = logicApp.name
output logicAppUrl string = 'https://${logicApp.properties.defaultHostName}'
output logicAppResourceId string = logicApp.id

output mcpServerEndpoint string = 'https://${functionApp.properties.defaultHostName}/api/mcp'
output healthEndpoint string = 'https://${functionApp.properties.defaultHostName}/api/health'
output mcpServerAudience string = 'api://${baseName}-mcp'

output appInsightsName string = appInsights.name
output appInsightsPortalUrl string = 'https://portal.azure.com/#@/resource${appInsights.id}/overview'
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name

output deployCommand string = 'func azure functionapp publish ${functionApp.name}'
