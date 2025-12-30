# Diagnosing Workflow Failures

When a user asks "Why is my workflow failing?" or similar, follow these steps.

## Step 1: Identify the Workflow

**If user didn't specify which Logic App:**
```
Call: list_logic_apps
Parameters: 
  - subscriptionId (required)
  - resourceGroupName (optional, if known from context)
```

Present the list and ask which one they mean, OR infer from context if obvious.

**For Standard Logic Apps**, also get workflows:
```
Call: list_workflows
Parameters:
  - subscriptionId
  - resourceGroupName  
  - logicAppName
```

## Step 2: Find Recent Failures

```
Call: search_runs
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard only)
  - status: "Failed"
  - top: 10
```

**Analyze the results:**
- How many failures?
- When did they start? (look at startTime)
- Is it all runs or intermittent?

**If no failures found**, tell the user and suggest checking:
- Different time range (use startTime/endTime)
- Check for "Cancelled" status too

## Step 3: Get Failure Details

For the most recent failure:
```
Call: get_run_details
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - runId: [from step 2]
```

Note the overall error if present.

## Step 4: Find the Failing Action

```
Call: get_run_actions
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - runId: [from step 2]
```

**Look for:**
- Actions with `status: "Failed"`
- Note the action name and type
- Check if it's in a loop (might need get_action_repetitions)

## Step 5: Get Error Details

```
Call: get_action_io
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - runId
  - actionName: [failing action from step 4]
  - type: "both"
```

**Examine:**
- Input: What data was sent to the action?
- Output: What error was returned?
- Look for: status codes, error messages, exception details

## Step 6: Check for Known Issues

```
Call: get_troubleshooting_guide
Parameters:
  - topic: "run-failures"
```

Match the error to known patterns:
- 401/403 → Authentication/authorization issue
- 404 → Resource not found
- 429 → Rate limiting
- 500/502/503 → Backend service issue
- Timeout → Long-running operation
- Expression error → Check get_troubleshooting_guide with "expression-errors"

## Step 7: Summarize for User

Provide a clear summary:

1. **What's failing**: "Your 'order-processor' workflow has failed 12 times in the last 24 hours"

2. **Where it fails**: "All failures occur at the 'Call_Backend_API' HTTP action"

3. **The error**: "The backend is returning 503 Service Unavailable"

4. **Pattern**: "Failures started at 2:30 PM yesterday and are ongoing"

5. **Suggested fix**: "Check if your backend API (api.example.com) is experiencing issues. You may need to contact that service's team."

## Special Cases

### Loop Failures
If the failing action is inside a ForEach or Until:
```
Call: get_action_repetitions
Parameters:
  - ... standard params ...
  - actionName: [the loop action name]
```
This shows which iterations failed.

### Intermittent Failures
If only some runs fail:
- Compare inputs between successful and failed runs
- Look for data-dependent issues
- Check for rate limiting patterns

### Trigger Never Fires
If user says "workflow isn't running":
```
Call: get_trigger_history
Parameters:
  - ... standard params ...
  - triggerName: [from get_workflow_triggers]
```
Check if trigger is receiving events but skipping them.
