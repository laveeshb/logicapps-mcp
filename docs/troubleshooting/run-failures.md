---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Run Failures

Debugging failed workflow runs, stuck executions, and trigger issues.

**Microsoft Docs:**
- [Monitor workflow run status](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps)
- [Handle errors and exceptions](https://learn.microsoft.com/azure/logic-apps/logic-apps-exception-handling)
- [Diagnose failures with Azure Monitor](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps-log-analytics)

## Debugging Steps

```
1. search_runs(status='Failed', startTime='2025-01-01T00:00:00Z')
      ↓
2. get_run_details(runId) → See overall status, error summary
      ↓
3. get_run_actions(runId) → Find which action failed
      ↓
4. get_action_io(runId, actionName) → See actual inputs/outputs
      ↓
5. For deeper issues:
   - get_expression_traces → Expression evaluation
   - get_action_repetitions → Loop iterations
   - get_action_request_history → HTTP request/response
```

---

## Action Failures

### ActionFailed

**Meaning:** The action itself threw an error.

**Debug:**
```
get_action_io(runId, actionName, type='both')
```

Look at:
- Inputs: Was the data correct?
- Outputs: What error was returned?
- Error code/message in outputs

### ActionTimedOut

**Meaning:** Action exceeded its timeout.

**Causes:**
- External service slow to respond
- Large data processing
- Network issues

**Solutions:**
1. Increase timeout in action settings
2. Add retry policy
3. Break into smaller operations
4. Use async pattern (webhook + callback)

### ActionSkipped

**Meaning:** Action didn't run due to runAfter conditions.

**Common reasons:**
- Previous action failed and this depends on success
- Condition evaluated to false branch
- Switch case didn't match

**Not an error** - just means action was intentionally skipped.

---

## Trigger Not Firing

### Check Trigger Configuration
```
get_workflow_triggers(subscriptionId, resourceGroupName, logicAppName, workflowName?)
```

Look at:
- Trigger type (Recurrence, HTTP, connector-based)
- Last fire time
- Next fire time (for recurrence)
- State (Enabled/Disabled)

### Check Trigger History
```
get_trigger_history(subscriptionId, resourceGroupName, logicAppName, triggerName, workflowName?)
```

Shows:
- When trigger checked for data
- Whether data was found
- Any errors during check

### Common Issues

**Recurrence not firing:**
- Workflow is disabled
- Time zone mismatch
- Schedule format wrong

**HTTP trigger not receiving:**
- Wrong URL (check `get_trigger_callback_url`)
- Caller not including SAS token
- Request body doesn't match schema

**Polling trigger (connector-based) not firing:**
- No new data in source system
- Connection expired
- Filter conditions too restrictive

### Manually Test Trigger
```
run_trigger(subscriptionId, resourceGroupName, logicAppName, triggerName, workflowName?)
```

Forces the trigger to fire immediately.

---

## Loop Issues

### ForEach Failures

**Debug iteration:**
```
get_action_repetitions(subscriptionId, resourceGroupName, logicAppName, runId, actionName)
```

Shows each iteration with:
- Repetition name (000000, 000001, etc.)
- Status (Succeeded, Failed)
- Inputs/outputs per iteration

**Common issues:**
- One bad item fails the whole loop (default behavior)
- Use `operationOptions: "Sequential"` if parallel causes issues
- Limit concurrency: `runtimeConfiguration.concurrency.repetitions`

**Continue on error:**
```json
{
  "type": "Foreach",
  "foreach": "@body('GetItems')",
  "operationOptions": "Sequential",
  "runtimeConfiguration": {
    "concurrency": { "repetitions": 1 }
  },
  "actions": { ... }
}
```

### Until Loop Hanging

**Known issue:** Delays and Do-Until can hang for hours.

**Mitigation:**
1. Always set explicit limits:
```json
{
  "type": "Until",
  "expression": "@equals(body('Check')['status'], 'done')",
  "limit": {
    "count": 60,
    "timeout": "PT1H"
  },
  "actions": { ... }
}
```

2. Add alerting for long-running workflows
3. Use `cancel_run` to stop stuck executions

### Scope Failures

**Debug scope:**
```
get_scope_repetitions(subscriptionId, resourceGroupName, logicAppName, runId, actionName)
```

Shows which branch executed in Condition/Switch, or scope status.

---

## Error Handling Patterns

### Try-Catch with Scope
```json
{
  "Try_Scope": {
    "type": "Scope",
    "actions": {
      "Risky_Action": { ... }
    }
  },
  "Catch_Scope": {
    "type": "Scope",
    "runAfter": {
      "Try_Scope": ["Failed", "TimedOut"]
    },
    "actions": {
      "Send_Alert": { ... },
      "Log_Error": {
        "type": "Compose",
        "inputs": "@result('Try_Scope')"
      }
    }
  },
  "Finally_Action": {
    "type": "Compose",
    "runAfter": {
      "Try_Scope": ["Succeeded", "Failed", "TimedOut", "Skipped"],
      "Catch_Scope": ["Succeeded", "Failed", "Skipped"]
    },
    "inputs": "Cleanup complete"
  }
}
```

### Retry Policies
```json
{
  "type": "Http",
  "inputs": { ... },
  "retryPolicy": {
    "type": "exponential",
    "count": 4,
    "interval": "PT10S",
    "minimumInterval": "PT5S",
    "maximumInterval": "PT1H"
  }
}
```

Types: `none`, `fixed`, `exponential`

### Configure Action Error Behavior

**runAfter conditions:**
- `Succeeded` - Run after success (default)
- `Failed` - Run after failure
- `Skipped` - Run if action was skipped
- `TimedOut` - Run after timeout

```json
{
  "Error_Handler": {
    "runAfter": {
      "Previous_Action": ["Failed", "TimedOut"]
    },
    "actions": { ... }
  }
}
```

---

## Stuck/Long-Running Executions

### Cancel a Run
```
cancel_run(subscriptionId, resourceGroupName, logicAppName, runId, workflowName?)
```

Only works on runs in "Running" or "Waiting" state.

### Find Stuck Runs
```
search_runs(status='Running', startTime='2025-01-01T00:00:00Z')
```

Look for runs that started long ago but are still "Running".

### Common Causes of Stuck Runs

1. **Delay action** - Intentionally waiting
2. **Until loop** - Condition never met
3. **Webhook waiting** - Waiting for callback
4. **Long-running connector** - External service slow

### Prevention

1. Set timeouts on all HTTP actions
2. Set limits on Until loops
3. Configure webhook timeout
4. Add monitoring/alerting for long runs

---

## Standard SKU: Platform-Specific Debugging

Standard Logic Apps run on the Azure Functions runtime with important differences for debugging.

### Understanding the Standard Architecture

```
Standard Logic App (Microsoft.Web/sites)
├── host.json                    # Runtime configuration
├── connections.json             # All connection definitions
├── local.settings.json          # App settings (local dev)
├── workflow1/
│   └── workflow.json            # Workflow definition
└── workflow2/
    └── workflow.json
```

Unlike Consumption (where everything is in the ARM resource), Standard stores workflows as **files in the VFS**.

### Check Host Runtime Status

Before debugging run failures, verify the runtime is healthy:

```
get_host_status(subscriptionId, resourceGroupName, logicAppName)
```

Returns:
- Runtime version
- Extension bundle version
- Health status

### Common Standard-Specific Issues

#### Workflow Not Starting After Deployment

**Symptom:** Workflow deployed but not triggering.

**Check:**
1. Is the workflow enabled?
   ```
   list_workflows(...) → Check state: "Enabled" vs "Disabled"
   ```
2. Check app settings for workflow state:
   ```
   App Setting: Workflows.{workflowName}.FlowState = Enabled
   ```

#### Connection Issues with Built-in Connectors

Built-in (Service Provider) connectors use app settings for connection strings:

```json
{
  "serviceProviderConnections": {
    "serviceBus": {
      "parameterValues": {
        "connectionString": "@appsetting('ServiceBusConnection')"
      }
    }
  }
}
```

**Debug:**
1. Check if app setting exists: Azure Portal → Logic App → Configuration
2. Verify connection string is valid
3. Check if Managed Identity has access (if using MI)

#### Extension Bundle Errors

**Symptom:** Actions fail with "extension not found" or binding errors.

**Solution:**
1. Check `host.json` for extension bundle version:
   ```json
   {
     "extensionBundle": {
       "id": "Microsoft.Azure.Functions.ExtensionBundle.Workflows",
       "version": "[1.*, 2.0.0)"
     }
   }
   ```
2. Update to latest bundle version if needed

### Standard vs Consumption: Debugging Differences

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| Get definition | ARM resource property | VFS file read |
| Enable/disable | Direct API | App settings update |
| Connection config | ARM resource | connections.json file |
| Runtime health | N/A (PaaS managed) | `get_host_status` |
| Logs | Azure Monitor | Azure Monitor + App Insights |

### Accessing Application Insights Logs (Standard)

Standard Logic Apps can integrate with Application Insights for deeper debugging:

1. **Transaction Search** - Find specific run by correlation ID
2. **Failures** - Aggregated exception view
3. **Performance** - Action duration metrics
4. **Logs (KQL)** - Custom queries:

```kusto
// Find failed workflow runs
traces
| where customDimensions.Category == "Workflow"
| where customDimensions.prop__status == "Failed"
| project timestamp, operation_Name, customDimensions.prop__workflowName, message
| order by timestamp desc
```
