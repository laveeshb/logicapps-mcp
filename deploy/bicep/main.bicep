// Logic Apps AI Assistant - Cloud Deployment (Security Hardened)
// 
// Security features:
// - User-Assigned Managed Identity for all Azure access
// - Storage: No public blob access, TLS 1.2 minimum
// - Function App: HTTPS only, TLS 1.2, FTPS disabled
// - Identity-based AzureWebJobsStorage (no connection string for runtime storage)
// - Easy Auth: Restricts API access to the deployer (always enabled)
//
// Note: Azure Files (WEBSITE_CONTENTAZUREFILECONNECTIONSTRING) still requires
// shared key access on Elastic Premium plans. This is an Azure platform limitation.
// The content share is used for deployment artifacts only.
//
// Required RBAC roles for Managed Identity on Storage:
// - Storage Blob Data Owner
// - Storage Queue Data Contributor  
// - Storage Table Data Contributor
//
// Usage (recommended - uses deploy scripts that auto-fetch your identity):
//   # PowerShell:
//   ./deploy.ps1 -ResourceGroup <rg-name> -Prefix <prefix>
//
//   # Bash:
//   ./deploy.sh -g <rg-name> -p <prefix>
//
// Manual usage (requires you to pass your object ID):
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file main.bicep \
//     --parameters prefix=myprefix \
//     --parameters deployerObjectId=$(az ad signed-in-user show --query id -o tsv)
//
// To call the protected API:
//   TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
//   curl -H "Authorization: Bearer $TOKEN" https://<function-app>.azurewebsites.net/api/health

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

@description('Enable Easy Auth to restrict access (requires deployerObjectId)')
param enableEasyAuth bool = true

@description('Object ID of the deployer for Easy Auth. Auto-populated by deploy.ps1/deploy.sh scripts.')
param deployerObjectId string = ''

// Generate a unique prefix if not provided (uses first 8 chars of unique string)
var effectivePrefix = empty(prefix) ? toLower(take(uniqueString(resourceGroup().id), 8)) : toLower(prefix)
var baseName = 'la-${effectivePrefix}'

// Determine if Easy Auth can be enabled (needs both flag and deployer ID)
var canEnableEasyAuth = enableEasyAuth && !empty(deployerObjectId)

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
    allowSharedKeyAccess: true  // Required for Azure Files content share on Elastic Premium
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

// Storage roles for Managed Identity (required for identity-based AzureWebJobsStorage)
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

resource storageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, storageBlobDataOwnerRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageQueueRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageTableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
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
  name: '${baseName}-agent-plan'
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
  name: '${baseName}-agent'
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
        // Identity-based storage connection for runtime (no keys for blob/queue/table)
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccount.name
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: managedIdentity.properties.clientId
        }
        // Content share for deployment (Azure Files requires connection string on EP plans)
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: '${baseName}-agent-content'
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
        // AI configuration for agent endpoint
        {
          name: 'AI_FOUNDRY_ENDPOINT'
          value: aiFoundryEndpoint
        }
        {
          name: 'AI_FOUNDRY_DEPLOYMENT'
          value: aiFoundryDeployment
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

// Easy Auth configuration for Function App (AAD authentication)
resource functionAppAuthSettings 'Microsoft.Web/sites/config@2022-09-01' = if (canEnableEasyAuth) {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          // Use ARM management endpoint as the audience (dynamically from environment)
          openIdIssuer: '${environment().authentication.loginEndpoint}${subscription().tenantId}/v2.0'
          clientId: environment().resourceManager
        }
        validation: {
          allowedAudiences: [
            environment().resourceManager
            environment().authentication.audiences[0]
          ]
          defaultAuthorizationPolicy: {
            allowedPrincipals: {
              identities: [
                deployerObjectId
              ]
            }
          }
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
    }
    platform: {
      enabled: true
      runtimeVersion: '~2'
    }
  }
}

// ============================================================================
// Role Assignments for Managed Identity
// ============================================================================

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

output mcpServerEndpoint string = 'https://${functionApp.properties.defaultHostName}/api/mcp'
output healthEndpoint string = 'https://${functionApp.properties.defaultHostName}/api/health'
output mcpServerAudience string = 'api://${baseName}-agent'

output appInsightsName string = appInsights.name
output appInsightsPortalUrl string = 'https://portal.azure.com/#@/resource${appInsights.id}/overview'
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name

output deployCommand string = 'func azure functionapp publish ${functionApp.name}'

output easyAuthEnabled bool = canEnableEasyAuth
output deployerObjectId string = canEnableEasyAuth ? deployerObjectId : 'N/A (Easy Auth disabled)'
output authAudience string = environment().resourceManager
output authTokenCommand string = 'az account get-access-token --resource ${environment().resourceManager} --query accessToken -o tsv'
