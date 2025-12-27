# Fixing a Workflow

When a user asks "Fix this workflow" or wants to modify an existing workflow to resolve issues.

## Step 1: Understand the Problem

If not already done, diagnose the issue first:
- See [diagnose-failures.md](diagnose-failures.md) for failure analysis
- See [explain-workflow.md](explain-workflow.md) to understand current behavior

Common fix requests:
- Add error handling/retry
- Fix broken connector
- Update API endpoint
- Add logging
- Change schedule

## Step 2: Get Current Definition

```
Call: get_workflow_definition
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
```

Save the current definition - you'll modify this.

## Step 3: Get Authoring Patterns

```
Call: get_authoring_guide
Parameters:
  - topic: "workflow-patterns"
```

Reference this for:
- Retry policies
- Error handling patterns
- Scope (try/catch) blocks

## Step 4: Make the Fix

### Adding Retry Policy

Add to the failing action:
```json
"retryPolicy": {
  "type": "exponential",
  "count": 3,
  "interval": "PT20S",
  "minimumInterval": "PT10S",
  "maximumInterval": "PT1H"
}
```

### Adding Error Handling (Scope)

Wrap actions in a scope:
```json
"Try_Scope": {
  "type": "Scope",
  "actions": {
    "Risky_Action": { ... }
  },
  "runAfter": {}
},
"Catch_Scope": {
  "type": "Scope",
  "actions": {
    "Log_Error": {
      "type": "Compose",
      "inputs": "@result('Try_Scope')"
    },
    "Send_Alert": { ... }
  },
  "runAfter": {
    "Try_Scope": ["Failed", "TimedOut"]
  }
}
```

### Updating an Endpoint

Find the action and update the URI:
```json
"Call_API": {
  "type": "Http",
  "inputs": {
    "method": "GET",
    "uri": "https://new-api.example.com/v2/data"  // Updated
  }
}
```

### Adding Logging

Add Compose actions to capture state:
```json
"Log_Input": {
  "type": "Compose",
  "inputs": {
    "timestamp": "@utcNow()",
    "action": "Processing order",
    "orderId": "@triggerBody()?['orderId']"
  },
  "runAfter": {}
}
```

## Step 5: Update the Workflow

```
Call: update_workflow
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - definition: [modified definition]
  - connections: [if connections changed, for Consumption]
```

## Step 6: Test the Fix

Run the workflow:
```
Call: run_trigger
Parameters:
  - triggerName: [main trigger]
```

Check the result:
```
Call: list_run_history
Parameters:
  - top: 1
```

If it failed:
```
Call: get_run_actions
Call: get_action_io
```

## Step 7: Verify Fix Worked

Compare before and after:
- Does it handle the error case now?
- Does retry kick in?
- Is the new endpoint working?

**Example output:**
```
✓ Updated 'order-processor' with the following changes:

1. Added retry policy to 'Call_Backend_API':
   - 3 retries with exponential backoff
   - Max wait: 1 hour

2. Added error handling scope:
   - Catches failures from API call
   - Sends alert email on failure
   - Logs error details

I tested the workflow and it now handles the 503 error gracefully:
- First attempt failed (503)
- Retry succeeded after 20 seconds
- Order was processed successfully
```

## Rollback If Needed

If the fix made things worse, you can restore from version history (Consumption only):
```
Call: list_workflow_versions
Parameters: [standard params]
```

Then get the previous version:
```
Call: get_workflow_version
Parameters:
  - versionId: [previous version]
```

And update back to it.
