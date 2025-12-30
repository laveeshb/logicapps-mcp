# Cloud Agent

Deploy an AI-powered agent to Azure that can investigate and manage Logic Apps on your behalf.

## When to Use

- **Enterprise policies** restrict individual access to production resources
- Teams need **shared, audited access** through a controlled identity
- You want to **investigate Logic Apps across subscriptions** you don't personally have access to
- No local AI assistant is available
- You need a **REST API** for automation or integration

## Prerequisites

- Azure CLI (`az login`)
- Azure Functions Core Tools (`func`)
- Node.js and npm
- An Azure OpenAI resource with a gpt-4o deployment (or let the script create one)

## Deploy

### Option 1: Create new Azure OpenAI resource

```powershell
# PowerShell
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateAiResource -CreateResourceGroup

# Bash
./deploy/deploy.sh -g my-rg --create-ai-resource --create-rg
```

### Option 2: Use existing Azure OpenAI

```powershell
# PowerShell
./deploy/deploy.ps1 -ResourceGroup my-rg -AiFoundryEndpoint https://my-openai.openai.azure.com -CreateResourceGroup

# Bash
./deploy/deploy.sh -g my-rg --ai-endpoint https://my-openai.openai.azure.com --create-rg
```

### What the Script Does

1. Shows your subscription and asks for confirmation
2. Creates resource group (if `-CreateResourceGroup`)
3. Creates Azure OpenAI resource and gpt-4o deployment (if `-CreateAiResource`)
4. Deploys infrastructure (Function App, Storage, App Insights, Managed Identity)
5. Configures Easy Auth (only you can access the API)
6. Builds and deploys the function code
7. Grants Azure OpenAI RBAC access (if `-CreateAiResource`)

### Script Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-ResourceGroup` / `-g` | Resource group name | Required |
| `-CreateAiResource` / `--create-ai-resource` | Create new Azure OpenAI | - |
| `-AiFoundryEndpoint` / `--ai-endpoint` | Use existing Azure OpenAI | - |
| `-AppLocation` / `-l` | Function App region | `westus2` |
| `-AiLocation` / `--ai-location` | Azure OpenAI region | `eastus` |
| `-CreateResourceGroup` / `--create-rg` | Create resource group | - |
| `-Yes` / `-y` | Skip confirmation prompt | - |

## After Deployment

The script outputs the **Managed Identity ID** - save this for the next step.

```
--------------------------------------------
IMPORTANT: Save this ID for granting RBAC:

  Managed Identity: caad7555-2efd-455f-993c-2e90afcdc1df

--------------------------------------------
```

Grant the managed identity access to your Logic Apps:

```bash
az role assignment create \
  --assignee <managed-identity-id> \
  --role "Reader" \
  --scope /subscriptions/<subscription-id>
```

For write operations (create/update/delete workflows), use `Logic App Contributor` role instead.

If you used `--ai-endpoint` (existing Azure OpenAI), also grant access to it:

```bash
az role assignment create \
  --assignee <managed-identity-id> \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<openai-resource>
```

## Call the Agent

```bash
# Get Azure AD token
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# Call the agent
curl -X POST "https://<app>.azurewebsites.net/api/agent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "List my Azure subscriptions"}'
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Health check |
| `/api/mcp` | Raw MCP protocol (JSON-RPC) |
| `/api/agent` | AI-powered agent (natural language) |

## Architecture

The cloud agent consists of:

- **Azure Function App**: Hosts the MCP server and agent endpoint
- **User-Assigned Managed Identity**: Authenticates to Azure resources
- **Azure OpenAI**: Provides the AI model (gpt-4o) for the agent
- **App Insights + Log Analytics**: Monitoring and logging
- **Easy Auth**: Restricts API access to the deployer

All authentication is identity-based (no keys or secrets).
