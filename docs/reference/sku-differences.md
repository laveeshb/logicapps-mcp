---
version: 0.3.0
lastUpdated: 2025-12-26
---

# SKU Differences

Detailed comparison of Consumption and Standard Logic Apps.

---

## Quick Comparison

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| Pricing | Per action execution | Dedicated compute |
| Scale | Auto, serverless | VNet, App Service plan |
| Workflows | 1 per resource | Multiple per Logic App |
| Connections | V1 API connections | V2 with connectionRuntimeUrl |
| State | Stored in Azure | Local file storage |
| Deployment | ARM only | ARM + workflow files |
| Local dev | Limited | VS Code extension |

---

## Resource Types

### Consumption

```
Microsoft.Logic/workflows
```

Single ARM resource containing:
- Definition
- Parameters
- State
- Run history

### Standard

```
Microsoft.Web/sites (kind: functionapp,workflowapp)
  └── Workflows (files in VFS)
       ├── workflow1/
       │    └── workflow.json
       ├── workflow2/
       │    └── workflow.json
       └── connections.json
```

Built on Azure Functions runtime.

---

## API Differences

### Get Workflow Definition

**Consumption:**
```
GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Logic/workflows/{name}
```

Definition is in `properties.definition`.

**Standard:**
```
GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{name}/hostruntime/admin/vfs/{workflowName}/workflow.json
```

Workflow is a file in VFS.

---

### Enable/Disable Workflow

**Consumption:**
```
POST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Logic/workflows/{name}/enable
POST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Logic/workflows/{name}/disable
```

Direct API calls.

**Standard:**

No direct API. Uses app settings:

```
App Setting: Workflows.{workflowName}.FlowState = Enabled | Disabled
```

Requires:
1. Get current app settings
2. Update the FlowState setting
3. PUT updated settings

The MCP tools handle this automatically.

---

### Run History

**Consumption:**
```
GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Logic/workflows/{name}/runs
```

**Standard:**
```
GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{name}/hostruntime/runtime/webhooks/workflow/api/management/workflows/{workflow}/runs
```

Different base paths.

---

## Connections

### V1 Connections (Consumption)

```json
{
  "parameters": {
    "$connections": {
      "value": {
        "office365": {
          "connectionId": "/subscriptions/.../providers/Microsoft.Web/connections/office365",
          "connectionName": "office365",
          "id": "/subscriptions/.../providers/Microsoft.Web/locations/.../managedApis/office365"
        }
      }
    }
  }
}
```

### V2 Connections (Standard)

**connections.json file:**
```json
{
  "managedApiConnections": {
    "office365": {
      "api": {
        "id": "/subscriptions/.../providers/Microsoft.Web/locations/.../managedApis/office365"
      },
      "connection": {
        "id": "/subscriptions/.../providers/Microsoft.Web/connections/office365"
      },
      "connectionRuntimeUrl": "https://xyz.azure-apim.net/apim/office365/..."
    }
  },
  "serviceProviderConnections": {
    "AzureBlob": {
      "parameterValues": {
        "connectionString": "@appsetting('AzureWebJobsStorage')"
      },
      "serviceProvider": {
        "id": "/serviceProviders/AzureBlob"
      }
    }
  }
}
```

Key differences:
- `connectionRuntimeUrl` required for V2
- `serviceProviderConnections` for built-in connectors
- App settings references with `@appsetting()`

### V2 Connection Authorization

1. Create connection via API (returns in "Unauthenticated" state for OAuth)
2. User opens portal and authorizes
3. Access policy auto-created with `type: "ActiveDirectory"`

**Note:** V2 access policies use `ActiveDirectory` type, NOT `ServicePrincipal`.

---

## Built-in Connectors

Standard has built-in connectors that don't require API connections:

| Connector | Standard Built-in | Consumption |
|-----------|------------------|-------------|
| HTTP | Yes | Yes |
| Service Bus | Yes (high perf) | API connection |
| Event Hub | Yes | API connection |
| Azure Blob | Yes | API connection |
| SQL | Yes | API connection |
| Azure Functions | Yes | API connection |

Built-in connectors in Standard:
- No managed connection needed
- Configure via `serviceProviderConnections`
- Higher throughput

---

## Deployment

### Consumption

Single ARM deployment:
```bash
az deployment group create \
  --resource-group myRG \
  --template-file logicapp.json
```

Definition is embedded in ARM template.

### Standard

Two-phase deployment:

1. **Deploy Logic App resource:**
```bash
az deployment group create \
  --resource-group myRG \
  --template-file infrastructure.json
```

2. **Deploy workflows:**
```bash
# Package workflows
zip -r deploy.zip .

# Deploy via ZipDeploy
az webapp deployment source config-zip \
  --resource-group myRG \
  --name my-logic-app \
  --src deploy.zip
```

Or use VFS API via MCP tools:
```
create_workflow(subscriptionId, resourceGroupName, logicAppName, workflowName, definition)
```

---

## Local Development

### Consumption

- Limited local testing
- Use Azure Portal designer
- ARM template export

### Standard

- VS Code extension with full designer
- Local debugging with Azurite
- `func host start` to run locally
- NuGet extension bundles

**Local project structure:**
```
my-logic-app/
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── Artifacts/
├── lib/
├── workflow1/
│   └── workflow.json
├── connections.json
├── host.json
├── local.settings.json
└── parameters.json
```

---

## Performance Considerations

### Consumption

- Serverless, auto-scale
- Cold start latency possible
- Pay per execution (cheap for low volume)
- Regional redundancy built-in

### Standard

- Dedicated compute
- No cold starts (always running)
- Pay for compute time
- VNet integration supported
- Can be more cost-effective at high volume

---

## Feature Availability

| Feature | Consumption | Standard |
|---------|-------------|----------|
| VNet integration | No | Yes |
| Private endpoints | No | Yes |
| Custom connectors | Yes | Yes |
| Integration account | Optional | Optional |
| B2B/EDI | Yes | Yes |
| ISE connectors | ISE only | Some built-in |
| Stateless workflows | No | Yes |
| Local debugging | No | Yes |

---

## When to Choose

**Choose Consumption when:**
- Low volume workloads
- Simple integrations
- Pay-per-use preferred
- No VNet requirements

**Choose Standard when:**
- High volume workloads
- VNet integration needed
- Local development important
- Multiple related workflows
- Need stateless for high throughput

---

## MCP Tool Considerations

The MCP tools handle SKU differences automatically:

| Operation | Consumption | Standard |
|-----------|-------------|----------|
| get_workflow_definition | Direct property | VFS file read |
| create/update_workflow | ARM API | VFS file write |
| enable/disable | Direct API | App settings update |
| run_trigger | Direct API | Runtime webhook API |
| list_run_history | Direct API | Runtime webhook API |

**Caller's responsibility:**
- Provide `workflowName` for Standard (not needed for Consumption)
- Understand connection patterns (V1 vs V2)
