// Logic Apps AI Assistant - Cloud Deployment
// 
// This Bicep template deploys:
// - User-Assigned Managed Identity
// - Function App (MCP Server)
// - Logic App Standard (for Agent Loop)
// - Required role assignments
//
// Prerequisites:
// - Azure AI Foundry with GPT-4o deployment (created separately)
// - Azure subscription with Logic Apps and Functions capability
//
// Usage:
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file main.bicep \
//     --parameters prefix=myprefix
//
// Or let it auto-generate a prefix:
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file main.bicep

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
// Storage Account (required for both Function App and Logic App)
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
// Function App (MCP Server)
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
    siteConfig: {
      nodeVersion: '~20'
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
          value: '${baseName}-mcp-content'
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
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentity.properties.clientId
        }
      ]
    }
  }
}

// Easy Auth for Function App - DISABLED FOR TESTING
// Uncomment the resource below to restrict access to only the Managed Identity
//
// resource functionAppAuth 'Microsoft.Web/sites/config@2022-09-01' = {
//   parent: functionApp
//   name: 'authsettingsV2'
//   properties: {
//     globalValidation: {
//       requireAuthentication: true
//       unauthenticatedClientAction: 'Return401'
//     }
//     identityProviders: {
//       azureActiveDirectory: {
//         enabled: true
//         registration: {
//           openIdIssuer: 'https://sts.windows.net/${subscription().tenantId}/v2.0'
//           clientId: 'api://${baseName}-mcp'
//         }
//         validation: {
//           allowedAudiences: [
//             'api://${baseName}-mcp'
//           ]
//           defaultAuthorizationPolicy: {
//             allowedPrincipals: {
//               identities: [
//                 managedIdentity.properties.principalId
//               ]
//             }
//           }
//         }
//       }
//     }
//   }
// }

// ============================================================================
// Logic App Standard (Agent Loop Host)
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
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentity.properties.clientId
        }
        // AI Foundry configuration (optional - can be configured later)
        {
          name: 'AI_FOUNDRY_ENDPOINT'
          value: aiFoundryEndpoint
        }
        {
          name: 'AI_FOUNDRY_DEPLOYMENT'
          value: aiFoundryDeployment
        }
      ]
    }
  }
}

// ============================================================================
// Role Assignments
// ============================================================================

// Logic App Contributor role for managing Logic Apps
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

output deployCommand string = 'func azure functionapp publish ${functionApp.name}'
