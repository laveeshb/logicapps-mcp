---
version: 0.3.0
lastUpdated: 2025-12-30
---

# Logic Apps MCP Server - Cloud Deployment

## Overview

A cloud-hosted MCP server deployed to Azure Functions, using passthrough authentication. Clients must provide their own ARM-scoped bearer token—the server has no Azure credentials of its own.

---

## Target Users

| Profile | Details |
|---------|---------|
| **Use Case** | Remote AI integrations, hosted MCP clients |
| **LLM** | Bring your own (any MCP-compatible client) |
| **Auth** | Passthrough - client provides bearer token |
| **Cost** | Azure Function App (EP1) + Storage + App Insights |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI Client (Any MCP-compatible)                                             │
│  - Claude Desktop, Copilot, custom agent, etc.                              │
│  - Responsible for obtaining ARM token                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS + Bearer token
                    │ Authorization: Bearer <ARM-scoped-token>
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure Function App (MCP Server)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ /api/mcp ──────────────────────────────────────────────────────────┐   │
│  │  MCP Protocol Handler                                                 │   │
│  │                                                                       │   │
│  │  1. Extract bearer token from Authorization header                   │   │
│  │  2. Store token in request context                                   │   │
│  │  3. Process MCP request (tool discovery, tool execution)             │   │
│  │  4. For ARM calls, use the stored token                              │   │
│  │  5. Return MCP response                                              │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ /api/health ───────────────────────────────────────────────────────┐   │
│  │  Health check endpoint (no auth required)                            │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Managed Identity: Only for storage access (Functions runtime)             │
│  No managed identity for ARM - all ARM access is passthrough               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS + Bearer token (passthrough)
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure Resource Manager (management.azure.com)                              │
│  └── Logic Apps REST APIs                                                   │
│      - User only sees resources they have access to                         │
│      - Permissions based on client's token                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Model

### Passthrough Design

The server does **not** have its own Azure credentials for ARM API calls. All Azure access is through the client's token.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI Client     │────▶│   MCP Server     │────▶│   Azure ARM     │
│                 │     │  (Function App)  │     │   APIs          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │  Authorization:       │  Uses client's         │
        │  Bearer <ARM-token>   │  token directly        │
        └───────────────────────┴────────────────────────┘
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **User-scoped access** | Users only see resources they have access to |
| **No server credentials** | No managed identity for ARM means no over-privileged access |
| **Audit trail** | All ARM calls are attributed to the user's token |
| **Simpler deployment** | No RBAC assignments needed for ARM access |

### Token Requirements

The client must provide an ARM-scoped bearer token:

```bash
# Azure CLI
az account get-access-token --resource https://management.azure.com --query accessToken -o tsv

# PowerShell
(Get-AzAccessToken -ResourceUrl https://management.azure.com).Token
```

The token must have appropriate permissions to access the Logic Apps resources the user wants to manage.

---

## Deployment

### What Gets Created

| Resource | Purpose |
|----------|---------|
| **Function App (EP1)** | Hosts the MCP server |
| **Storage Account** | Required for Functions runtime |
| **Application Insights** | Telemetry and monitoring |
| **Log Analytics Workspace** | Logs storage |
| **User-Assigned Managed Identity** | Storage access only |

### Deploy Commands

```bash
# PowerShell
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateResourceGroup

# Bash
./deploy/deploy.sh -g my-rg --create-rg
```

## API Endpoints

### MCP Endpoint

```
POST https://<app>.azurewebsites.net/api/mcp
Authorization: Bearer <ARM-token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### Health Endpoint

```
GET https://<app>.azurewebsites.net/api/health

Response: {"status":"ok","version":"0.2.0"}
```

---

## Implementation Details

### Token Extraction

```typescript
// src/functions/index.ts
const authHeader = request.headers.get("authorization");
const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");

if (bearerToken) {
  setPassthroughToken(bearerToken);
}
```

### Token Usage

```typescript
// src/auth/tokenManager.ts
export async function getAccessToken(): Promise<string> {
  if (!passthroughToken) {
    throw new McpError(
      "AuthenticationError",
      "Bearer token required. Provide Authorization header with ARM-scoped token."
    );
  }
  return passthroughToken;
}
```

### Token Cleanup

```typescript
// After each request
finally {
  clearPassthroughToken();
}
```

---

## Error Handling

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

### Invalid Token

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

---

## Security Considerations

### Access Control

- **No server-side Azure access**: The Function App has no managed identity for ARM
- **User-scoped permissions**: Each request is limited to what the token holder can access
- **Token per request**: Tokens are cleared after each request to prevent leakage

### Network

- **HTTPS only**: All endpoints require HTTPS
- **TLS 1.2+**: Minimum TLS version enforced
- **Optional VNet integration**: Can be added for network isolation

### Storage

- **Managed Identity for storage**: The Function App uses MI for its own storage access
- **No shared key access**: Storage operations use identity-based auth

---

## Comparison with Local MCP Server

| Aspect | Local | Cloud |
|--------|-------|-------|
| **Transport** | stdio | HTTP |
| **Auth** | Azure CLI (`az login`) | Passthrough (bearer token) |
| **Token source** | @azure/identity | Client provides |
| **Runs on** | User's machine | Azure Function App |
| **Best for** | Individual developers | Remote/hosted AI clients |

---

## Troubleshooting

### "Bearer token required" Error

Client is not providing an Authorization header. Ensure:
```bash
curl -H "Authorization: Bearer $TOKEN" https://<app>/api/mcp
```

### "The access token is from the wrong issuer" Error

Token is not scoped for ARM. Get a new token:
```bash
az account get-access-token --resource https://management.azure.com --query accessToken -o tsv
```

### "AuthorizationFailed" Error

User doesn't have permission to access the resource. Grant appropriate RBAC role to the user's identity.

---

## Future Enhancements

| Enhancement | Status |
|-------------|--------|
| Optional Easy Auth integration | Considered |
| VNet integration template | Considered |
| Custom domain support | Considered |
