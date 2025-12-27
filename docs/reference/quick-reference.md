---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Quick Reference

Skeleton guide with brief summaries and links to Microsoft documentation.

---

## Security

**Microsoft Docs:**
- [Secure access and data](https://learn.microsoft.com/azure/logic-apps/logic-apps-securing-a-logic-app)
- [Authenticate with Managed Identity](https://learn.microsoft.com/azure/logic-apps/create-managed-service-identity)
- [Set up private endpoints](https://learn.microsoft.com/azure/logic-apps/secure-single-tenant-workflow-virtual-network-private-endpoint)

### Key Concepts

| Topic | Summary | Doc Link |
|-------|---------|----------|
| **Hide inputs/outputs** | Obfuscate sensitive data in run history | [Secure inputs and outputs](https://learn.microsoft.com/azure/logic-apps/logic-apps-securing-a-logic-app#obfuscate) |
| **IP restrictions** | Limit inbound calls to specific IPs | [Restrict inbound IP addresses](https://learn.microsoft.com/azure/logic-apps/logic-apps-securing-a-logic-app#restrict-inbound-ip-addresses) |
| **Managed Identity** | Access Azure resources without secrets | [Authenticate with MI](https://learn.microsoft.com/azure/logic-apps/create-managed-service-identity) |
| **Private endpoints** | Keep traffic on private network (Standard) | [Set up private endpoints](https://learn.microsoft.com/azure/logic-apps/secure-single-tenant-workflow-virtual-network-private-endpoint) |
| **SAS tokens** | Secure HTTP trigger URLs | [Generate shared access signatures](https://learn.microsoft.com/azure/logic-apps/logic-apps-securing-a-logic-app#generate-shared-access-signatures-sas) |

### Common Security Actions

**Enable Managed Identity:**
- Azure Portal → Logic App → Identity → System assigned → On
- Use in HTTP action: `"authentication": { "type": "ManagedServiceIdentity", "audience": "..." }`

**Hide sensitive data:**
```json
{
  "type": "Http",
  "inputs": { ... },
  "runtimeConfiguration": {
    "secureData": {
      "properties": ["inputs", "outputs"]
    }
  }
}
```

---

## Monitoring & Alerts

**Microsoft Docs:**
- [Monitor Logic Apps](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps)
- [Set up Azure Monitor logs](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps-log-analytics)
- [Create alerts](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps#set-up-monitoring-alerts)

### Key Metrics

| Metric | Use Case |
|--------|----------|
| `Triggers Failed` | Alert on trigger failures |
| `Runs Failed` | Alert on workflow failures |
| `Run Latency` | Monitor performance degradation |
| `Actions Failed` | Track action-level errors |
| `Billable Action Executions` | Cost monitoring (Consumption) |

### Set Up Alert (Example)

**Symptom:** CPU rising on Standard Logic App

**Solution:** Configure auto-scale or investigate workflows
→ [Scale Standard Logic Apps](https://learn.microsoft.com/azure/logic-apps/edit-app-settings-host-settings#scale-out)

**Symptom:** Runs failing frequently

**Solution:** Set up Azure Monitor alert:
1. Logic App → Alerts → Create alert rule
2. Signal: "Runs Failed"
3. Condition: Greater than 5 in 1 hour
→ [Create monitoring alerts](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps#set-up-monitoring-alerts)

### Application Insights (Standard)

Standard Logic Apps can send telemetry to Application Insights:
1. Create Application Insights resource
2. Add app setting: `APPINSIGHTS_INSTRUMENTATIONKEY=<key>`
3. Query with KQL in Log Analytics
→ [Monitor with Application Insights](https://learn.microsoft.com/azure/logic-apps/create-single-tenant-workflows-azure-portal#enable-run-history-and-alerts)

---

## Testing

**Microsoft Docs:**
- [Test with mock data (static results)](https://learn.microsoft.com/azure/logic-apps/test-logic-apps-mock-data-static-results)
- [Create unit tests (Standard)](https://learn.microsoft.com/azure/logic-apps/testing-framework/create-unit-tests-standard-workflow-definitions-visual-studio-code)

### Static Results (Mock Data)

Test actions without calling real services:
1. Designer → Action → ... menu → Static result
2. Configure mock response (status, headers, body)
3. Enable static results on workflow

Use for: Testing error handling, avoiding side effects during dev.

### Unit Testing (Standard Only)

Standard workflows support unit testing via VS Code extension:
1. Generate test from workflow definition
2. Mock connector responses  
3. Assert on workflow outputs
→ [Unit testing framework](https://learn.microsoft.com/azure/logic-apps/testing-framework/overview)

---

## Pricing

**Microsoft Docs:**
- [Pricing model](https://learn.microsoft.com/azure/logic-apps/logic-apps-pricing)
- [Pricing calculator](https://azure.microsoft.com/pricing/calculator/)

### Quick Comparison

| SKU | Pricing Model | When Cost-Effective |
|-----|---------------|---------------------|
| **Consumption** | Per action execution | Low volume (<100K actions/month) |
| **Standard** | vCPU + memory (dedicated) | High volume, predictable workloads |

### Cost Optimization Tips

| Tip | Details |
|-----|---------|
| **Reduce actions** | Combine actions, use `Compose` instead of `Initialize Variable` |
| **Filter at trigger** | Use trigger conditions to avoid unnecessary runs |
| **Use built-in (Standard)** | Service Bus, Blob built-in connectors are included |
| **Monitor billable executions** | Metric: `Billable Action Executions` |

→ [Estimate costs](https://learn.microsoft.com/azure/logic-apps/plan-manage-costs)

---

## Integration Accounts (B2B)

**Microsoft Docs:**
- [Integration accounts overview](https://learn.microsoft.com/azure/logic-apps/logic-apps-enterprise-integration-create-integration-account)
- [B2B enterprise integration](https://learn.microsoft.com/azure/logic-apps/logic-apps-enterprise-integration-overview)

### When Needed

| Feature | Requires Integration Account |
|---------|------------------------------|
| Execute JavaScript (Consumption) | Yes |
| AS2/X12/EDIFACT | Yes |
| XML validation/transform | Yes |
| Partner/agreement management | Yes |
| Maps (XSLT) | Yes |
| Schemas (XSD) | Yes |

### Tiers

| Tier | Artifacts | Price (approx) |
|------|-----------|----------------|
| Free | 25 maps, 25 schemas | Free |
| Basic | Unlimited artifacts | ~$30/month |
| Standard | + B2B, RosettaNet | ~$300/month |

---

## Agent Workflows (Preview)

**Microsoft Docs:**
- [AI agent workflows concepts](https://learn.microsoft.com/azure/logic-apps/agent-workflows-concepts)
- [Create autonomous agent workflows](https://learn.microsoft.com/azure/logic-apps/create-autonomous-agent-workflows)
- [Create conversational agent workflows](https://learn.microsoft.com/azure/logic-apps/create-conversational-agent-workflows)

### Overview

Logic Apps now supports AI agent orchestration using:
- **Agent Loop action** - Iteratively calls LLM with tools until task complete
- **MCP Server support** - Bring your own MCP servers for tools
- **Azure AI Foundry integration** - Use GPT-4, etc.

### Use Cases

| Type | Description |
|------|-------------|
| **Autonomous agents** | Background task automation with LLM reasoning |
| **Conversational agents** | Chat interfaces with tool calling |
| **Hybrid** | Logic Apps workflow + AI decision making |

→ [Agent Loop MCP support announcement](https://techcommunity.microsoft.com/blog/integrationsonazureblog/announcing-mcp-server-support-for-logic-apps-agent-loop/4470778)

---

## Limits Reference

**Microsoft Docs:**
- [Service limits and configuration](https://learn.microsoft.com/azure/logic-apps/logic-apps-limits-and-config)

### Key Limits

| Limit | Consumption | Standard |
|-------|-------------|----------|
| Actions per workflow | 500 | 500 |
| Workflows per Logic App | 1 | Unlimited |
| Run duration | 90 days | 90 days |
| Run history retention | 90 days | 90 days |
| Message size | 100 MB | 100 MB |
| Concurrent runs | 100K | Based on plan |
| Trigger frequency | Every 1 second | Every 1 second |

→ [Full limits reference](https://learn.microsoft.com/azure/logic-apps/logic-apps-limits-and-config)
