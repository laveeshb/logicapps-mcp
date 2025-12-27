# Cloud Deployment

Deploy the Logic Apps AI Assistant to Azure.

## Architecture

```
┌─ User-Assigned Managed Identity ──────────────────────────────────────────┐
│  Roles: Logic App Contributor, Reader                                      │
│  Assigned to: Function App + Logic App                                     │
└────────────────────────────────────────────────────────────────────────────┘
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
┌─ Function App (EP1) ──────┐  ┌─ Logic App Standard (WS1) ──────────────────┐
│  MCP Server               │  │  Agent Loop Workflow                        │
│  - 36 MCP tools           │  │  - Uses Function App as MCP Server         │
│  - HTTP transport         │  │  - Calls Azure AI Foundry for LLM          │
│  - Easy Auth (MI only)    │  │  - Exposes chat endpoint                   │
└───────────────────────────┘  └─────────────────────────────────────────────┘
```

## Prerequisites

1. **Azure CLI** installed and logged in
2. **Azure subscription** with:
   - Logic Apps Standard capability
   - Functions capability
   - Azure AI Foundry (optional, can configure later)

3. **Permissions** to:
   - Create resource groups
   - Create Managed Identities
   - Assign roles

## Quick Start

### 1. Deploy Infrastructure

```bash
# Create resource group
az group create --name logicapps-assistant-rg --location westus2

# Deploy resources
az deployment group create \
  --resource-group logicapps-assistant-rg \
  --template-file main.bicep \
  --parameters baseName=logicapps-assistant
```

### 2. Deploy Function App Code

```bash
# Build the MCP server
cd ../..
npm run build

# Deploy to Function App (using ZIP deploy)
func azure functionapp publish logicapps-assistant-mcp
```

### 3. Deploy Agent Loop Workflow

Logic App Standard workflows are file-based. Deploy using the Azure CLI:

```bash
# Get deployment credentials
DEPLOY_USER=$(az webapp deployment list-publishing-profiles \
  --name logicapps-assistant-agent \
  --resource-group logicapps-assistant-rg \
  --query "[?publishMethod=='MSDeploy'].userName" -o tsv)

DEPLOY_PASS=$(az webapp deployment list-publishing-profiles \
  --name logicapps-assistant-agent \
  --resource-group logicapps-assistant-rg \
  --query "[?publishMethod=='MSDeploy'].userPWD" -o tsv)

# Create workflow folder structure
mkdir -p agent-loop-deploy/agent-loop

# Copy workflow definition
cp workflows/agent-loop.json agent-loop-deploy/agent-loop/workflow.json

# Create host.json
cat > agent-loop-deploy/host.json << 'EOF'
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle.Workflows",
    "version": "[1.*, 2.0.0)"
  }
}
EOF

# ZIP and deploy
cd agent-loop-deploy
zip -r ../workflow-deploy.zip .
cd ..

az webapp deployment source config-zip \
  --name logicapps-assistant-agent \
  --resource-group logicapps-assistant-rg \
  --src workflow-deploy.zip

# Cleanup
rm -rf agent-loop-deploy workflow-deploy.zip
```

Alternatively, use the Azure Portal:
1. Open the Logic App in Azure Portal
2. Go to "Workflows" > "Create"
3. Import from `workflows/agent-loop.json`

### 4. Configure Workflow Parameters

After deploying the workflow, configure the parameters in the Logic App:

1. Open the Logic App in Azure Portal → "Configuration"
2. Update the workflow parameters:
   - `mcpServerUrl`: `https://logicapps-assistant-mcp.azurewebsites.net/api/mcp`
   - `aiModelEndpoint`: Your Azure AI Foundry endpoint
   - `aiModelDeployment`: `gpt-4o` (or your deployment name)

Or update via Azure CLI:

```bash
az logicapp config appsettings set \
  --name logicapps-assistant-agent \
  --resource-group logicapps-assistant-rg \
  --settings \
    "Workflows.agent-loop.Parameters.mcpServerUrl=https://logicapps-assistant-mcp.azurewebsites.net/api/mcp" \
    "Workflows.agent-loop.Parameters.aiModelEndpoint=https://your-ai-foundry.openai.azure.com"
```

## Estimated Costs

| Resource | SKU | Estimated Monthly |
|----------|-----|-------------------|
| Logic App Standard | WS1 | ~$175 |
| Function App | EP1 | ~$150 |
| Storage Account | Standard LRS | ~$5 |
| AI Foundry (usage) | Pay-per-token | Varies |
| **Total (idle)** | | **~$330** |

## Security

- **Zero secrets**: All auth via Managed Identity
- **Easy Auth**: Function App only accepts tokens from the MI
- **HTTPS only**: All traffic encrypted
- **VNet optional**: Can add VNet integration for network isolation

## Files

- `bicep/main.bicep` - Infrastructure as Code template
- `workflows/agent-loop.json` - Agent Loop workflow definition

## Troubleshooting

### Function App returns 401

1. Verify Easy Auth is configured
2. Check MI is assigned to both resources
3. Ensure audience matches: `api://logicapps-assistant-mcp`

### Tools not discovered

1. Check Function App is running: `https://<function-app>/api/health`
2. Verify MCP endpoint responds: `POST /api/mcp` with initialize request
3. Check Logic App can reach Function App (VNet rules)

### AI Model errors

1. Verify AI Foundry endpoint is correct
2. Check MI has "Cognitive Services User" role on AI Foundry
3. Ensure deployment name matches configuration
