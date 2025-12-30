# Configuration

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AZURE_TENANT_ID` | Azure AD tenant ID | `common` |
| `AZURE_CLIENT_ID` | Azure AD app registration client ID | Azure CLI public client |
| `AZURE_SUBSCRIPTION_ID` | Default subscription ID | None |
| `AZURE_CLOUD` | Azure cloud environment | `AzurePublic` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |

## Config File (Optional)

Create `~/.logicapps-mcp/config.json`:

```json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "defaultSubscriptionId": "your-subscription-id"
}
```

## Azure Cloud Options

- `AzurePublic` (default)
- `AzureGovernment`
- `AzureChina`

## Authentication

This MCP server uses Azure CLI for authentication. Before using it, ensure you're logged in:

```bash
az login
```

The MCP server will automatically use the Azure CLI's tokens. Tokens are refreshed automatically.

### Required Azure Permissions

| Role | Scope | Purpose |
|------|-------|---------|
| `Logic App Contributor` | Subscription/RG/Resource | Create, update, delete workflows; run triggers |
| `Reader` | Subscription/RG | List resources and resource groups |

For read-only access, `Logic App Reader` is sufficient.

## SKU Differences

Logic Apps come in two SKUs with different architectures. This MCP server handles both transparently, but there are some important differences:

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| Resource Type | `Microsoft.Logic/workflows` | `Microsoft.Web/sites` + workflows |
| Workflows per Resource | 1 (Logic App = Workflow) | Multiple workflows per Logic App |
| Enable/Disable | Direct API call | Uses app settings (`Workflows.<name>.FlowState`) |
| Connections | V1 API connections | V2 API connections with `connectionRuntimeUrl` |
| Create/Update | ARM API | VFS API (file-based) |

### API Connections for Standard Logic Apps

Standard Logic Apps use **V2 API connections** which require additional setup:

1. **Create V2 connection** with `kind: "V2"` property
2. **Authorize via Azure Portal** (OAuth connectors require browser-based consent)
3. **Create access policy** to grant the Logic App's managed identity access to the connection
4. **Update connections.json** in the Logic App with the `connectionRuntimeUrl`

> **Note**: The `create_connection` tool creates the connection resource, but for Standard Logic Apps with OAuth connectors (Office 365, SharePoint, etc.), you'll need to authorize the connection in the Azure Portal and manually configure the access policy and `connections.json`.

## Installation

### Via npm (from GitHub)

```bash
npm install -g github:laveeshb/logicapps-mcp
```

Or use directly with npx:

```bash
npx github:laveeshb/logicapps-mcp
```

### From Source

```bash
git clone https://github.com/laveeshb/logicapps-mcp.git
cd logicapps-mcp
npm install
npm run build
```
