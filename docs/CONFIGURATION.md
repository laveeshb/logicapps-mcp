# Configuration

Advanced configuration options for the local MCP server. Most users won't need these - the defaults work with `az login`.

## Environment Variables

| Variable | Purpose | Default Behavior |
|----------|---------|------------------|
| `AZURE_TENANT_ID` | Lock to a specific Azure AD tenant | Uses `common` - auto-detects tenant from your login |
| `AZURE_CLIENT_ID` | Use a custom app registration | Uses Azure CLI's public client ID |
| `AZURE_SUBSCRIPTION_ID` | Set a default subscription | None - you'll specify subscription in each request |
| `AZURE_CLOUD` | Connect to sovereign clouds | `AzurePublic` |
| `LOG_LEVEL` | Control verbosity (debug, info, warn, error) | `info` |

### When to use these

- **Multi-tenant scenarios**: Set `AZURE_TENANT_ID` to avoid tenant picker prompts
- **Enterprise policies**: Set `AZURE_CLIENT_ID` if your org requires a specific app registration
- **Single subscription**: Set `AZURE_SUBSCRIPTION_ID` to skip specifying it in every request
- **Government/China clouds**: Set `AZURE_CLOUD` to `AzureGovernment` or `AzureChina`

## Config File

Alternative to environment variables. Create `~/.logicapps-mcp/config.json`:

```json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "defaultSubscriptionId": "your-subscription-id"
}
```

Environment variables take precedence over the config file.

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

## See Also

- [Getting Started](GETTING_STARTED.md) - Setup guides for local MCP server or cloud agent
- [Available Tools](TOOLS.md) - All 37 tools
- [Cloud MCP Server](CLOUD_MCP_SERVER.md) - Deploy to Azure for team/enterprise use
