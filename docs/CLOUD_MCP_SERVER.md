# Cloud MCP Server

Deploy the Logic Apps MCP server to Azure as a hosted service. Uses passthrough authentication—clients must provide their own ARM-scoped bearer token.

## When to Use

- You need a **hosted MCP server** accessible over HTTP
- Your AI client doesn't run locally (remote/cloud-based)
- You want to expose MCP tools to custom integrations
- You need a centralized MCP endpoint for multiple AI clients

## Architecture

The cloud MCP server is a pure passthrough service:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    AI Client     │ ──> │    MCP Server    │ ──> │    Azure ARM     │
│                  │     │  (Function App)  │     │      APIs        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
          │                        │                        │
          │ Authorization:         │ Uses client's          │
          │ Bearer <ARM-token>     │ token directly         │
          └────────────────────────┴────────────────────────┘
```

**Key points:**
- No managed identity for ARM access
- All ARM calls use the client's token
- Users only see resources they have access to
- No Azure OpenAI—bring your own AI client

## Prerequisites

- Azure CLI (`az login`)
- Azure Functions Core Tools (`func`)
- Node.js 20+ and npm

## Deploy

```powershell
# PowerShell
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateResourceGroup

# Bash
./deploy/deploy.sh -g my-rg --create-rg
```

### What Gets Created

| Resource | Purpose |
|----------|---------|
| Function App (EP1) | Hosts the MCP server |
| Storage Account | Required for Functions runtime |
| Application Insights | Monitoring and telemetry |
| Managed Identity | Storage access only (not for ARM) |

### Script Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-ResourceGroup` / `-g` | Resource group name | Required |
| `-Prefix` / `-p` | Resource name prefix | Auto-generated |
| `-Location` / `-l` | Azure region | `westus2` |
| `-CreateResourceGroup` / `--create-rg` | Create resource group | - |
| `-SkipCodeDeploy` / `--skip-code-deploy` | Skip building and deploying code | - |
| `-Yes` / `-y` | Skip confirmation prompt | - |

## After Deployment

Test the health endpoint:

```bash
# Get an ARM-scoped token
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# Test health
curl -H "Authorization: Bearer $TOKEN" https://<your-app>.azurewebsites.net/api/health

# Expected: {"status":"ok","version":"0.2.0"}
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/mcp` | POST | MCP protocol (JSON-RPC) |

## Authentication

### Passthrough Model

The server requires an ARM-scoped bearer token in the `Authorization` header. It uses this token directly for all Azure Resource Manager API calls.

**No fallback**: If no token is provided, tool calls will fail with an authentication error.

### Alternative: Managed Identity

If your use case requires server-side Azure access (e.g., trusted internal clients), you can modify the deployment to use managed identity for ARM calls instead of passthrough:

1. Grant the Function App's managed identity `Reader` role (or `Logic App Contributor` for write operations) on the target subscriptions

2. Update `src/auth/tokenManager.ts` to use `DefaultAzureCredential` as a fallback:

```typescript
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();

export async function getAccessToken(): Promise<string> {
  // Use passthrough token if provided
  if (passthroughToken) {
    return passthroughToken;
  }

  // Fall back to managed identity
  const tokenResponse = await credential.getToken(
    "https://management.azure.com/.default"
  );
  if (!tokenResponse?.token) {
    throw new McpError("AuthenticationError", "Failed to get access token");
  }
  return tokenResponse.token;
}
```

This approach gives the server its own Azure access, so clients don't need to provide tokens. However, all users will see resources based on the managed identity's permissions, not their own.

### Getting a Token

```bash
# Azure CLI
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# PowerShell
$token = (Get-AzAccessToken -ResourceUrl https://management.azure.com).Token
```

### Making Requests

```bash
curl -X POST "https://<app>.azurewebsites.net/api/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Error Responses

### No Token Provided

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Bearer token required. Provide Authorization header with ARM-scoped token."
  },
  "id": null
}
```

### Invalid or Expired Token

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "AuthenticationError: The access token is from the wrong issuer..."
  },
  "id": null
}
```

### Insufficient Permissions

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "AuthorizationFailed: The client does not have authorization to perform action..."
  },
  "id": null
}
```

## Security

- **HTTPS only**: All endpoints require HTTPS
- **TLS 1.2+**: Minimum TLS version enforced
- **No server credentials for ARM**: All access is through client tokens
- **Token isolation**: Tokens are cleared after each request
- **Managed Identity for storage only**: Used only for Functions runtime storage access

## See Also

- [Getting Started](GETTING_STARTED.md) - Setup guides and comparison with local MCP server
- [Available Tools](TOOLS.md) - All 40 tools available via MCP
- [Configuration](CONFIGURATION.md) - Environment variables and authentication
