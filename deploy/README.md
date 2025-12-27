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

# Create deployment package
# (Function App deployment steps - see Azure Functions docs)
```

### 3. Configure Agent Loop

After deployment:

1. Open the Logic App in Azure Portal
2. Create a new workflow with Agent Loop action
3. Configure MCP Server:
   - Type: "Bring Your Own MCP"
   - URL: `https://<function-app>.azurewebsites.net/api/mcp`
   - Auth: Managed Identity
   - Audience: `api://logicapps-assistant-mcp`

4. Configure AI Model:
   - Connect to Azure AI Foundry
   - Select GPT-4o deployment

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

- `main.bicep` - Main deployment template
- `agent-workflow/` - Agent Loop workflow definition (TODO)

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
