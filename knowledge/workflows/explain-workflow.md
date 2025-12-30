# Explaining a Workflow

When a user asks "What does this workflow do?" or wants to understand a workflow's logic.

## Step 1: Get the Workflow Definition

```
Call: get_workflow_definition
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard only)
```

## Step 2: Analyze the Structure

Parse the definition and identify:

### Trigger
- What starts the workflow?
- HTTP request, schedule, event, connector trigger?
- What data does it receive?

### Actions
Walk through the actions in execution order:
- What does each action do?
- What data flows between actions?
- Are there conditions or branches?

### Control Flow
- **Condition**: What logic branches the flow?
- **ForEach**: What collection is being processed?
- **Switch**: What cases are handled?
- **Scope**: Are there try/catch patterns?

## Step 3: Identify Integrations

Look for:
- **HTTP actions**: External API calls
- **Connector actions**: Azure services, SaaS integrations
- **Built-in actions**: Variables, compose, parse JSON

Note which external systems the workflow interacts with.

## Step 4: Check Recent Runs (Optional)

To show real examples of what it processes:
```
Call: list_run_history
Parameters:
  - subscriptionId
  - resourceGroupName
  - logicAppName
  - workflowName (for Standard)
  - top: 5
```

This shows how often it runs and success rate.

## Step 5: Summarize for User

Provide a clear explanation:

**Example output:**
```
This workflow processes new orders:

1. **Triggers** when an HTTP POST is received at /api/orders
2. **Parses** the order JSON from the request body
3. **Validates** the order has required fields
4. **For each line item**:
   - Checks inventory via the Inventory API
   - Reserves the item if available
5. **If all items available**:
   - Creates the order in SQL database
   - Sends confirmation email via Office 365
6. **If any item unavailable**:
   - Sends "items unavailable" response
   - Logs to Application Insights

The workflow runs about 50 times per day with 98% success rate.
```

## Diagram Format (Optional)

If user wants a visual:
```
HTTP Request
    │
    ▼
Parse Order JSON
    │
    ▼
Validate Order ──No──► Return 400 Bad Request
    │ Yes
    ▼
ForEach Line Item
    │
    ├──► Check Inventory
    │       │
    │       ▼
    │    Reserve Item
    │
    ▼
All Available? ──No──► Return "Items Unavailable"
    │ Yes
    ▼
Create Order (SQL)
    │
    ▼
Send Confirmation Email
    │
    ▼
Return 200 Success
```
