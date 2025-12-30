# Creating a Workflow

When a user asks "Create a workflow that..." or wants to build a new Logic App.

## Step 1: Understand Requirements

Ask clarifying questions if needed:
- What triggers the workflow? (HTTP, schedule, event, connector)
- What should it do? (call APIs, transform data, send notifications)
- What systems does it integrate with?
- Consumption or Standard?

## Step 2: Get Authoring Guidance

```
Call: get_authoring_guide
Parameters:
  - topic: "workflow-patterns"
```

Use patterns for:
- Trigger types
- Error handling
- Control flow

## Step 3: Discover Connectors (If Needed)

If the workflow uses connectors (SQL, Service Bus, Office 365, etc.):
```
Call: get_connector_swagger
Parameters:
  - subscriptionId
  - location: [Logic App region]
  - connectorName: [e.g., "sql", "servicebus", "office365"]
```

This shows:
- Available operations
- Required parameters
- Schema for inputs/outputs

## Step 4: Build the Definition

Structure the workflow JSON:

```json
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {},
  "triggers": {
    "trigger_name": {
      "type": "...",
      "inputs": {}
    }
  },
  "actions": {
    "action_name": {
      "type": "...",
      "inputs": {},
      "runAfter": {}
    }
  }
}
```

### Common Trigger Types

**HTTP Request:**
```json
"When_a_HTTP_request_is_received": {
  "type": "Request",
  "kind": "Http",
  "inputs": {
    "method": "POST",
    "schema": { ... }
  }
}
```

**Recurrence (Schedule):**
```json
"Recurrence": {
  "type": "Recurrence",
  "recurrence": {
    "frequency": "Hour",
    "interval": 1
  }
}
```

### Common Action Types

**HTTP Call:**
```json
"Call_API": {
  "type": "Http",
  "inputs": {
    "method": "GET",
    "uri": "https://api.example.com/data"
  },
  "runAfter": {}
}
```

**Condition:**
```json
"Check_Status": {
  "type": "If",
  "expression": {
    "equals": ["@body('Previous_Action')?['status']", "success"]
  },
  "actions": { ... },
  "else": { "actions": { ... } }
}
```

## Step 5: Create the Workflow

```
Call: create_workflow
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName (new name for Consumption, existing for Standard)
  - workflowName (for Standard only)
  - definition: [the JSON you built]
  - location: [Azure region, for Consumption]
  - connections: [if using connectors, for Consumption]
```

## Step 6: Verify It Works

```
Call: get_workflow_triggers
Parameters: [same as above]
```

For HTTP triggers, get the URL:
```
Call: get_trigger_callback_url
Parameters:
  - triggerName: [trigger name]
```

Test it:
```
Call: run_trigger
Parameters:
  - triggerName: [trigger name]
```

Then check:
```
Call: list_run_history
Parameters:
  - top: 1
```

## Step 7: Report to User

**Example output:**
```
✓ Created workflow 'order-processor' in resource group 'production-rg'

Trigger URL: https://prod-123.logic.azure.com:443/workflows/abc...

To test:
POST to the URL with your order JSON.

I ran a test and it completed successfully.

Next steps:
- Add error handling for API failures
- Configure retry policies
- Set up monitoring alerts
```

## Error Handling

If creation fails:
- Check if resource group exists
- Verify connector connections are set up
- Validate the definition schema
- Check quotas and permissions
