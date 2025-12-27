---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Deployment Guide

Deploying Logic Apps via ARM templates, Terraform, and CI/CD pipelines.

---

## Deployment Models

| SKU | Approach | Notes |
|-----|----------|-------|
| Consumption | ARM template | Definition in resource properties |
| Standard | ARM + workflow files | Separate deployment for app and workflows |

---

## Consumption Logic Apps

### Basic ARM Template

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "logicAppName": {
      "type": "string"
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Logic/workflows",
      "apiVersion": "2019-05-01",
      "name": "[parameters('logicAppName')]",
      "location": "[parameters('location')]",
      "properties": {
        "state": "Enabled",
        "definition": {
          "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
          "contentVersion": "1.0.0.0",
          "triggers": {
            "manual": {
              "type": "Request",
              "kind": "Http",
              "inputs": { "schema": {} }
            }
          },
          "actions": {
            "Response": {
              "type": "Response",
              "inputs": { "statusCode": 200, "body": "Hello" },
              "runAfter": {}
            }
          }
        }
      }
    }
  ]
}
```

### With API Connection

```json
{
  "resources": [
    {
      "type": "Microsoft.Web/connections",
      "apiVersion": "2016-06-01",
      "name": "office365",
      "location": "[parameters('location')]",
      "properties": {
        "api": {
          "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), 'office365')]"
        },
        "displayName": "Office 365 Connection"
      }
    },
    {
      "type": "Microsoft.Logic/workflows",
      "apiVersion": "2019-05-01",
      "name": "[parameters('logicAppName')]",
      "location": "[parameters('location')]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/connections', 'office365')]"
      ],
      "properties": {
        "parameters": {
          "$connections": {
            "value": {
              "office365": {
                "connectionId": "[resourceId('Microsoft.Web/connections', 'office365')]",
                "connectionName": "office365",
                "id": "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), 'office365')]"
              }
            }
          }
        },
        "definition": {
          "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
          "contentVersion": "1.0.0.0",
          "parameters": {
            "$connections": { "defaultValue": {}, "type": "Object" }
          },
          "triggers": { ... },
          "actions": { ... }
        }
      }
    }
  ]
}
```

**Note:** OAuth connections (like Office 365) require manual authorization after deployment.

---

## Standard Logic Apps

Standard requires two deployments:

1. **App Service infrastructure** (Logic App resource)
2. **Workflow definitions** (via ZipDeploy or VFS API)

### ARM Template for Standard Logic App

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "logicAppName": { "type": "string" },
    "location": { "type": "string", "defaultValue": "[resourceGroup().location]" },
    "storageAccountName": { "type": "string" }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-02-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2"
    },
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2021-02-01",
      "name": "[concat(parameters('logicAppName'), '-plan')]",
      "location": "[parameters('location')]",
      "sku": {
        "tier": "WorkflowStandard",
        "name": "WS1"
      },
      "kind": "elastic"
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2021-02-01",
      "name": "[parameters('logicAppName')]",
      "location": "[parameters('location')]",
      "kind": "functionapp,workflowapp",
      "identity": { "type": "SystemAssigned" },
      "dependsOn": [
        "[resourceId('Microsoft.Web/serverfarms', concat(parameters('logicAppName'), '-plan'))]",
        "[resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]"
      ],
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', concat(parameters('logicAppName'), '-plan'))]",
        "siteConfig": {
          "appSettings": [
            {
              "name": "AzureWebJobsStorage",
              "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';EndpointSuffix=core.windows.net;AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')), '2021-02-01').keys[0].value)]"
            },
            {
              "name": "FUNCTIONS_EXTENSION_VERSION",
              "value": "~4"
            },
            {
              "name": "FUNCTIONS_WORKER_RUNTIME",
              "value": "node"
            },
            {
              "name": "AzureFunctionsJobHost__extensionBundle__id",
              "value": "Microsoft.Azure.Functions.ExtensionBundle.Workflows"
            }
          ]
        }
      }
    }
  ]
}
```

### Deploy Workflows to Standard

After deploying the Logic App resource, deploy workflows via ZIP:

```bash
# Package workflows
cd workflows/
zip -r ../deploy.zip .

# Deploy
az webapp deployment source config-zip \
  --resource-group myRG \
  --name my-logic-app \
  --src deploy.zip
```

Or via MCP tools:
```
create_workflow(subscriptionId, resourceGroupName, logicAppName, workflowName, definition)
```

---

## Terraform

### Consumption Logic App

```hcl
resource "azurerm_logic_app_workflow" "example" {
  name                = "my-logic-app"
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name

  workflow_parameters = {
    "$connections" = jsonencode({
      "defaultValue" = {}
      "type"         = "Object"
    })
  }

  parameters = {
    "$connections" = jsonencode({
      "office365" = {
        "connectionId"   = azurerm_api_connection.office365.id
        "connectionName" = "office365"
        "id"             = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/providers/Microsoft.Web/locations/${azurerm_resource_group.example.location}/managedApis/office365"
      }
    })
  }
}

resource "azurerm_api_connection" "office365" {
  name                = "office365"
  resource_group_name = azurerm_resource_group.example.name
  managed_api_id      = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/providers/Microsoft.Web/locations/${azurerm_resource_group.example.location}/managedApis/office365"
  display_name        = "Office 365 Connection"
}
```

### Standard Logic App

Use `azurerm_logic_app_standard` or deploy via ARM template.

---

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy Logic App

on:
  push:
    branches: [main]
    paths:
      - 'workflows/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy Consumption Logic App
        uses: azure/arm-deploy@v2
        with:
          resourceGroupName: my-resource-group
          template: ./arm/logicapp.json
          parameters: logicAppName=my-logic-app

      # For Standard: deploy workflows separately
      - name: Deploy Workflows (Standard only)
        if: ${{ env.SKU == 'standard' }}
        run: |
          cd workflows
          zip -r ../deploy.zip .
          az webapp deployment source config-zip \
            --resource-group my-resource-group \
            --name my-logic-app \
            --src deploy.zip
```

### Azure DevOps Pipeline

```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - workflows/*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: 'MyAzureConnection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        az deployment group create \
          --resource-group $(resourceGroup) \
          --template-file arm/logicapp.json \
          --parameters logicAppName=$(logicAppName)
```

---

## Secrets Management

### Key Vault Integration

1. Store secrets in Key Vault
2. Reference in ARM parameters:

```json
{
  "parameters": {
    "sqlPassword": {
      "reference": {
        "keyVault": {
          "id": "/subscriptions/.../resourceGroups/.../providers/Microsoft.KeyVault/vaults/my-vault"
        },
        "secretName": "sql-password"
      }
    }
  }
}
```

### App Settings for Standard

```json
{
  "name": "SQL_CONNECTION_STRING",
  "value": "@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/sql-connection/)"
}
```

---

## OAuth Connection Deployment

OAuth connections **cannot be fully automated**. Deployment flow:

1. Deploy connection resource (unauthenticated state)
2. Get consent link:
   ```bash
   az rest --method POST \
     --uri "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/connections/{conn}/confirmConsentCode?api-version=2016-06-01" \
     --body '{"code":"..."}'
   ```
3. Or document manual step: "Open portal, authorize connection"

For automated scenarios, prefer:
- Managed Identity (where supported)
- Service Principal with API permissions
- Connection strings / keys (stored in Key Vault)
