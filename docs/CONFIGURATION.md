# Configuration

Advanced configuration options for the local MCP server. Most users won't need these - the defaults work with `az login`.

## Environment Variables

| Variable | Purpose | Default Behavior |
|----------|---------|------------------|
| `AZURE_TENANT_ID` | Lock to a specific Azure AD tenant | Uses `common` - auto-detects tenant from your login |
| `AZURE_CLIENT_ID` | Use a custom app registration | Uses Azure CLI's public client ID |
| `AZURE_SUBSCRIPTION_ID` | Set a default subscription | None - you'll specify subscription in each request |
| `AZURE_CLOUD` | Connect to sovereign clouds | `AzurePublic` |
| `LOGICAPPS_MCP_LOG_LEVEL` | Control verbosity (debug, info, warn, error) | `info` |
| `LOGICAPPS_MCP_CACHE_TTL` | Cache duration in seconds | `300` |
| `LOGICAPPS_MCP_READ_ONLY` | Hide the tools that change or run anything (see [Read-only mode](#read-only-mode)) | `false` |

### When to use these

- **Multi-tenant scenarios**: Set `AZURE_TENANT_ID` to avoid tenant picker prompts
- **Enterprise policies**: Set `AZURE_CLIENT_ID` if your org requires a specific app registration
- **Single subscription**: Set `AZURE_SUBSCRIPTION_ID` to skip specifying it in every request
- **Government/China clouds**: Set `AZURE_CLOUD` to `AzureGovernment` or `AzureChina`

## Read-only mode

Read-only mode lists only the tools that cannot change or run anything, so an AI client cannot call `delete_workflow` or `run_trigger` by mistake. Turn it on with any of:

```bash
logicapps-mcp --read-only
LOGICAPPS_MCP_READ_ONLY=true logicapps-mcp
```

or `"readOnly": true` in the config file. Any non-empty value other than `false`, `0`, `no` or `off` turns read-only mode on, so a typo does not leave write tools available.

These tools are not available in read-only mode:

| Group | Tools |
|-------|-------|
| Create, change or delete | `create_workflow`, `update_workflow`, `delete_workflow`, `clone_workflow`, `enable_workflow`, `disable_workflow`, `create_connection` |
| Run something | `run_trigger`, `cancel_run`, `resubmit_run`, `invoke_connector_operation` |
| Returns a credential | `get_trigger_callback_url` (the signed URL can start the workflow) |

Read-only mode hides tools. It does not limit what your Azure account can do, so use the `Logic App Reader` role if the account itself should not be able to make changes.

## Config File

Alternative to environment variables. Create `~/.logicapps-mcp/config.json`:

```json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "defaultSubscriptionId": "your-subscription-id",
  "readOnly": false
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
- [Available Tools](TOOLS.md) - All 40 tools
- [Cloud MCP Server](design/CLOUD_MCP_SERVER.md) - Deploy to Azure for team/enterprise use
