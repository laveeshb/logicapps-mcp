# Clone Operation

Clone a Consumption Logic App workflow to a Standard Logic App.

**Microsoft Docs:** [Clone Consumption workflows to Standard workflows](https://learn.microsoft.com/en-us/azure/logic-apps/clone-consumption-logic-app-to-standard-workflow)

## Overview

The MCP tools provide a programmatic way to clone workflows, complementing the Azure Portal experience documented above.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `validate_clone_workflow` | Check compatibility before cloning |
| `clone_workflow` | Perform the clone operation |

## Usage

### Step 1: Validate

```
validate_clone_workflow(
  subscriptionId='source-sub',
  resourceGroupName='source-rg',
  logicAppName='my-consumption-app',
  targetSubscriptionId='target-sub',
  targetResourceGroupName='target-rg',
  targetLogicAppName='my-standard-app',
  targetWorkflowName='cloned-workflow'
)
```

**Response:**
- `isValid: true` → Proceed to clone
- `isValid: false` → Address errors first
- `warnings` → Review but can proceed

### Step 2: Clone

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

## MCP-Specific Notes

These details are specific to using the MCP tools (not covered in portal docs):

1. **Target must exist**: The Standard Logic App must already be deployed before cloning
2. **Workflow kind**: Specify `Stateful` (default) or `Stateless` via `targetKind` parameter
3. **Cross-subscription**: Use `targetSubscriptionId` to clone to a different subscription
4. **Definition only**: Only the workflow definition is cloned; connections require post-clone setup per the Microsoft docs

## See Also

- [Microsoft Docs: Clone Consumption to Standard](https://learn.microsoft.com/en-us/azure/logic-apps/clone-consumption-logic-app-to-standard-workflow) - Full guide including connection setup, networking, and known limitations
- [Tool Catalog](../reference/tool-catalog.md) - All MCP tools reference
