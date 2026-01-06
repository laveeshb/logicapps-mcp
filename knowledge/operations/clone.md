# Clone Operation

Clone a Consumption Logic App workflow to a Standard Logic App.

## Overview

Cloning copies a workflow definition from a Consumption Logic App to create a new workflow in an existing Standard Logic App. This is useful for:

- Moving workflows from Consumption to Standard SKU
- Copying workflow logic between environments
- Creating a Standard version of an existing Consumption workflow

**Important:** This clones the workflow definition only. Connections, parameters, and Integration Account references need to be reconfigured in the target.

## Prerequisites

Before cloning:

1. **Source**: A Consumption Logic App with a valid workflow definition
2. **Target**: An existing Standard Logic App (must already be deployed)
3. **Permissions**: Contributor access to both source and target resources

## Tools

| Tool | Purpose |
|------|---------|
| `validate_clone_workflow` | Check compatibility before cloning |
| `clone_workflow` | Perform the clone operation |
| `create_connection` | Create connections in target (post-clone) |
| `get_connections` | List existing connections |

## Steps

### Step 1: Validate the Clone

Always validate before cloning to identify potential issues:

```
validate_clone_workflow(
  subscriptionId='source-sub',
  resourceGroupName='source-rg',
  logicAppName='my-consumption-app',
  targetSubscriptionId='target-sub',
  targetResourceGroupName='target-rg',
  targetLogicAppName='my-standard-app',
  targetWorkflowName='cloned-workflow',
  targetKind='Stateful'
)
```

**Check the response:**
- `isValid: true` → Proceed to clone
- `isValid: false` → Address errors before continuing
- `warnings` → Review but can proceed

### Step 2: Clone the Workflow

If validation passes, perform the clone:

```
clone_workflow(
  subscriptionId='source-sub',
  resourceGroupName='source-rg',
  logicAppName='my-consumption-app',
  targetSubscriptionId='target-sub',
  targetResourceGroupName='target-rg',
  targetLogicAppName='my-standard-app',
  targetWorkflowName='cloned-workflow',
  targetKind='Stateful'
)
```

**Parameters:**
- `targetKind`: Choose `Stateful` (default) for run history retention, or `Stateless` for high-throughput scenarios

### Step 3: Verify the Clone

After cloning, verify the workflow exists:

```
list_workflows(
  subscriptionId='target-sub',
  resourceGroupName='target-rg',
  logicAppName='my-standard-app'
)
```

## Post-Operation: Configure Connections

The cloned workflow definition references connections that don't exist in the target. You must reconfigure them.

### Why Connections Need Reconfiguration

| Aspect | Consumption (V1) | Standard (V2) |
|--------|------------------|---------------|
| Connection format | `connectionId` only | `connectionId` + `connectionRuntimeUrl` |
| Storage | ARM resource reference | `connections.json` file |
| Auth | Shared access | Per-workflow access policies |

### Steps to Configure Connections

1. **List source connections** to understand what's needed:
   ```
   get_connections(
     subscriptionId='source-sub',
     resourceGroupName='source-rg'
   )
   ```

2. **Create connections in target resource group**:
   ```
   create_connection(
     subscriptionId='target-sub',
     resourceGroupName='target-rg',
     connectionName='office365-connection',
     connectorName='office365',
     location='eastus'
   )
   ```

3. **For OAuth connectors** (Office 365, SharePoint, etc.):
   - The `create_connection` response includes a consent link
   - Open the link in a browser to authorize
   - Complete the OAuth flow

4. **Update the workflow's connections.json**:
   - Standard workflows store connection references in `connections.json`
   - Use the Azure portal or VS Code extension to update connection references

### Connection Types

| Type | Example | Action Required |
|------|---------|-----------------|
| OAuth | Office 365, SharePoint | Create connection + authorize in portal |
| Connection String | SQL, Service Bus | Create connection with parameters |
| Managed Identity | Key Vault, Storage | Configure managed identity on Standard app |
| Built-in | HTTP, Compose | No connection needed (works automatically) |

## Common Issues

### Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Source must be Consumption" | Trying to clone from Standard | Clone only works Consumption → Standard |
| "Target must be Standard" | Target is Consumption | Ensure target Logic App is Standard SKU |
| "Target not found" | Logic App doesn't exist | Deploy the Standard Logic App first |

### Validation Warnings

| Warning | Meaning | Action |
|---------|---------|--------|
| "Uses API connection" | Workflow has connector actions | Reconfigure connections post-clone |
| "Integration Account" | Uses maps, schemas, or partners | Not supported in Standard; redesign required |

### Post-Clone Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Workflow fails on connector action | Connections not configured | Complete connection setup (see above) |
| "Connection not found" error | Missing `connections.json` entry | Update connections.json with V2 format |
| OAuth connector unauthorized | Consent not completed | Open consent link and authorize |

## Example: Complete Clone Workflow

```
# 1. Validate
validate_clone_workflow(
  subscriptionId='prod-sub',
  resourceGroupName='prod-rg',
  logicAppName='order-processor',
  targetSubscriptionId='prod-sub',
  targetResourceGroupName='standard-rg',
  targetLogicAppName='standard-apps',
  targetWorkflowName='order-processor-v2'
)

# 2. Clone (if validation passes)
clone_workflow(
  subscriptionId='prod-sub',
  resourceGroupName='prod-rg',
  logicAppName='order-processor',
  targetSubscriptionId='prod-sub',
  targetResourceGroupName='standard-rg',
  targetLogicAppName='standard-apps',
  targetWorkflowName='order-processor-v2'
)

# 3. Create required connections
create_connection(
  subscriptionId='prod-sub',
  resourceGroupName='standard-rg',
  connectionName='sql-orders',
  connectorName='sql',
  location='eastus',
  parameterValues={
    'server': 'orders-db.database.windows.net',
    'database': 'orders',
    'username': 'app-user',
    'password': '***'
  }
)

# 4. Verify
list_workflows(
  subscriptionId='prod-sub',
  resourceGroupName='standard-rg',
  logicAppName='standard-apps'
)
```

## See Also

- [SKU Differences](../reference/sku-differences.md) - Consumption vs Standard comparison
- [Connection Issues](../troubleshooting/connection-issues.md) - Troubleshooting connections
- [Tool Catalog](../reference/tool-catalog.md) - All MCP tools reference
