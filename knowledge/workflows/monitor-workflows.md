# Monitoring Workflows

When a user asks "What's running?", "Show me the status", or wants to monitor their Logic Apps.

## Step 1: List Logic Apps

```
Call: list_logic_apps
Parameters:
  - subscriptionId
  - resourceGroupName (optional)
  - sku: "all" (or "consumption"/"standard" if specified)
```

Note for each:
- Name
- SKU (Consumption vs Standard)
- State (Enabled/Disabled)
- Location

## Step 2: Get Workflows (Standard Only)

For each Standard Logic App:
```
Call: list_workflows
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
```

## Step 3: Check Recent Activity

For each workflow of interest:
```
Call: list_run_history
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - top: 10
```

Summarize:
- How many runs recently?
- Success vs failure rate
- Any currently running?

## Step 4: Find Problem Areas

Look for workflows with:
- High failure rate
- Runs stuck in "Running" status
- No recent runs (might be disabled or trigger issue)

For failures:
```
Call: search_runs
Parameters:
  - status: "Failed"
  - top: 10
  - startTime: [last 24 hours]
```

## Step 5: Check Running Workflows

If there are runs with status "Running":
```
Call: get_run_details
Parameters:
  - runId: [the running one]
```

Determine:
- How long has it been running?
- Is it stuck? (compare with typical duration)
- Should it be cancelled?

## Step 6: Present Dashboard Summary

**Example output:**
```
## Logic Apps Status (production-rg)

| Logic App | Type | Status | Last 24h | Success Rate |
|-----------|------|--------|----------|--------------|
| order-processor | Consumption | Enabled | 156 runs | 98% ✓ |
| inventory-sync | Standard | Enabled | 24 runs | 100% ✓ |
| notification-sender | Consumption | Enabled | 89 runs | 87% ⚠️ |
| data-cleanup | Consumption | Disabled | - | - |

### Attention Needed:
- **notification-sender**: 12 failures in last 24h (email service issues)
- **data-cleanup**: Disabled - intentional?

### Currently Running:
- order-processor run abc123 (started 2 min ago)
```

## Drill-Down Questions

If user asks for more detail on a specific workflow, use:
- `get_workflow_triggers` - When does it run?
- `search_runs` - Filter by status/time
- `get_run_actions` - What's happening in a specific run

## Automation Suggestions

If user is checking regularly, suggest:
- Azure Monitor alerts for failures
- Application Insights for detailed metrics
- Logic Apps built-in monitoring dashboard
