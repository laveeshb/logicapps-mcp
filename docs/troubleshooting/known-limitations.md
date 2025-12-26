# Known Limitations

Platform constraints that customers frequently encounter, with workarounds.

---

## Workflow Structure

### One Trigger Per Workflow

**Limitation:** A workflow can only have one trigger.

**Workaround:**
- Create multiple workflows, each with its own trigger
- Use a single HTTP trigger and route based on request content
- Use Event Grid to fan out to multiple workflows

### Can't Rename Logic Apps

**Limitation:** Once created, Logic App name cannot be changed.

**Workaround:**
1. Export definition (ARM template or `get_workflow_definition`)
2. Create new Logic App with desired name
3. Import definition
4. Update any external references (API URLs, etc.)
5. Delete old Logic App

### Maximum Actions Per Workflow

| SKU | Limit |
|-----|-------|
| Consumption | 500 actions |
| Standard | 500 actions per workflow |

**Workaround:** Break into child workflows, call via HTTP or nested workflow action.

---

## Code Execution

### JavaScript Requires Integration Account

**Limitation:** "Execute JavaScript Code" action in Consumption requires an Integration Account (Standard tier or higher).

**Error:** "The workflow must be associated with an integration account to use the Execute JavaScript Code action."

**Options:**
1. Attach Integration Account to Logic App (costs ~$300/month for Standard)
2. Use Azure Function instead (often cheaper)
3. Use built-in expression functions where possible
4. For Standard SKU: JavaScript works without Integration Account

### JavaScript Code Limits

| Limit | Value |
|-------|-------|
| Code size | 1024 characters (Consumption), 100KB (Standard) |
| Execution time | 10 seconds |
| Memory | Limited |

**Workaround:** Use Azure Functions for complex logic.

---

## Connections & Authentication

### OAuth Connections Can't Be Fully Automated

**Limitation:** OAuth-based connections (Office 365, Dynamics, etc.) require interactive browser consent.

**Impact:**
- ARM template deployment creates connection in "Unauthenticated" state
- User must manually authorize in Azure Portal
- Can't fully automate with CI/CD

**Partial automation:**
1. Deploy connection via ARM/Terraform
2. Use Azure CLI or API to get consent link
3. Document manual authorization step in runbook

### Shared Mailbox Access

**Limitation:** Office 365 connector connects to a single user's mailbox, not shared mailboxes directly.

**Workaround:**
- Grant the connecting user access to the shared mailbox
- Use Microsoft Graph API directly with proper permissions

---

## Runtime Behavior

### Delays and Until Loops Can Hang

**Known issue:** Delays and Do-Until actions sometimes hang for hours beyond their configured time.

**Mitigation:**
1. Always set explicit `limit.timeout` on Until actions
2. Set up Azure Monitor alerts for long-running workflows
3. Have a process to identify and cancel stuck runs
4. Use `cancel_run` to manually terminate

### Connector Throttling

Different connectors have different rate limits:

| Connector | Limit |
|-----------|-------|
| Office 365 | ~2000 requests/minute |
| SharePoint | ~600 requests/minute |
| SQL | Connection pool limits |
| HTTP | No built-in limit (target service may limit) |

**Mitigation:**
- Use retry policies with exponential backoff
- Batch operations where possible
- Spread load over time

---

## Monitoring & Diagnostics

### Run History Retention

| SKU | Default Retention |
|-----|-------------------|
| Consumption | 90 days |
| Standard | 90 days |

**Extend retention:**
- Enable diagnostic settings to Log Analytics
- Export to Storage Account for long-term

### Log Analytics Gaps (Standard)

**Issue:** Some Standard SKU workflow runs don't appear in Log Analytics.

**Workaround:**
- Use run history API (`list_run_history`, `search_runs`)
- Enable all diagnostic categories
- Check for ingestion delays (can be 5-15 minutes)

---

## Deployment & DevOps

### Connections in ARM Templates

**Challenge:** Connection strings and secrets in ARM templates.

**Best practices:**
1. Store secrets in Key Vault
2. Reference Key Vault in parameters
3. Use Managed Identity where possible
4. For OAuth: Deploy connection, document manual auth step

### Consumption vs Standard Deployment

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| Resource type | `Microsoft.Logic/workflows` | `Microsoft.Web/sites` + workflows |
| Workflow definition | In resource properties | Files in VFS |
| Connections | V1 API connections | V2 with connectionRuntimeUrl |
| Enable/Disable | Direct API property | App settings |

---

## Regional & Compliance

### Not All Connectors in All Regions

Some connectors are only available in certain regions.

**Check:** Use `get_connector_swagger` - returns 404 if not available in that region.

### Government Cloud Differences

Azure Government has different endpoints and some connectors unavailable.

---

## Expression & Data

### JSON Precision Loss

**Issue:** HTTP trigger auto-deserialization can lose precision on large numbers (>2^53).

**Workaround:**
- Accept as string, parse manually
- Use `@string()` to preserve precision
- Disable auto-parse: set schema to accept raw string

### Binary Data Handling

**Issue:** Logic Apps is primarily text/JSON based. Binary data requires base64 encoding.

**For file operations:**
```
@base64(body('Get_File'))           -- Encode
@base64ToBinary(body('Message'))    -- Decode
@body('Get_Blob')['$content']       -- Get base64 content from blob
```

---

## Standard SKU Specific

### Linux Not Supported

**Limitation:** Standard Logic Apps only run on Windows App Service plans.

Despite what pricing page may imply, you cannot deploy to Linux App Service plans.

### ARM64 Not Supported

Windows ARM64 is not supported for local development or deployment.

---

## Workaround Patterns

### Need Multiple Triggers → Multiple Workflows + Router
```
[Event Grid Topic] → [Router Logic App] → [Workflow A]
                                       → [Workflow B]
                                       → [Workflow C]
```

### Complex Logic → Azure Functions
Move complex JavaScript/C# logic to Azure Functions, call via HTTP action.

### Long-Running Process → Durable Functions
For workflows > 5-10 minutes with complex orchestration, consider Durable Functions.

### High Throughput → Service Bus + Multiple Workers
Decouple with Service Bus queue, scale with multiple Logic App instances or Functions.
