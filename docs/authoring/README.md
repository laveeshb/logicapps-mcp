# Authoring Guide

Patterns and examples for creating Logic Apps workflows.

## Quick Start

1. Identify trigger type (HTTP, Schedule, Connector)
2. Use `get_connector_swagger` to discover operations
3. Use `invoke_connector_operation` to get schemas (tables, queues)
4. Create workflow definition JSON
5. Deploy with `create_workflow`
6. Test with `run_trigger`

## Guides

- [Workflow Patterns](workflow-patterns.md) - HTTP, Recurrence, Error handling
- [Connector Patterns](connector-patterns.md) - SQL, Service Bus, Blob, Office 365
- [Deployment Guide](deployment.md) - ARM, Terraform, CI/CD

## Workflow Definition Basics

Every workflow has this structure:
```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "parameters": { },
    "triggers": { },
    "actions": { },
    "outputs": { }
  }
}
```

### Execution Order

Actions run based on `runAfter`:
```json
{
  "Action_A": { "runAfter": {} },                    // Runs first (after trigger)
  "Action_B": { "runAfter": { "Action_A": ["Succeeded"] } },  // After A
  "Action_C": { "runAfter": { "Action_A": ["Succeeded"] } },  // Also after A (parallel with B)
  "Action_D": { "runAfter": { "Action_B": ["Succeeded"], "Action_C": ["Succeeded"] } }  // After B and C
}
```

### runAfter Conditions

| Condition | Meaning |
|-----------|---------|
| `Succeeded` | Run if action succeeded |
| `Failed` | Run if action failed |
| `Skipped` | Run if action was skipped |
| `TimedOut` | Run if action timed out |

Combine for error handling: `["Failed", "TimedOut"]`

## Tool Workflow

### Creating a New Workflow

```
1. User describes: "When a file is uploaded to blob, send email with attachment"

2. Identify components:
   - Trigger: Blob trigger (When a blob is added or modified)
   - Action 1: Get blob content
   - Action 2: Send email with attachment

3. Get connector schemas:
   get_connector_swagger('azureblob')
   get_connector_swagger('office365')

4. Check available connections:
   get_connections(resourceGroupName)

5. If connection missing, create or instruct user:
   create_connection('office365', ...)

6. Build definition JSON

7. Deploy:
   create_workflow(definition)

8. Test:
   run_trigger(triggerName) or upload test blob
```

### Modifying Existing Workflow

```
1. Get current definition:
   get_workflow_definition()

2. Parse and modify the JSON

3. Update:
   update_workflow(definition)

4. Verify:
   run_trigger() or wait for trigger
   get_run_details() + get_run_actions()
```
