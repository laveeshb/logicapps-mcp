/**
 * Registers all MCP tools and prompts with the server.
 * Each tool is imported from its respective module and registered here.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { handleToolCall } from "./tools/handler.js";

const LOGIC_APPS_GUIDE = `# Azure Logic Apps MCP Server Guide

## SKU Types
Logic Apps come in two SKUs with different APIs:

### Consumption (Serverless)
- Single workflow per Logic App resource
- Use \`logicAppName\` parameter directly (no workflowName needed)
- Billed per execution

### Standard (App Service-based)
- Multiple workflows per Logic App
- Always specify \`workflowName\` parameter
- Stateful and Stateless workflow types

## Common Workflows

### 1. Debug a Failed Run
\`\`\`
list_run_history → find the failed run
get_run_details → see error summary  
get_run_actions → find which action failed
get_action_io → see actual inputs/outputs
get_expression_traces → debug expression failures
\`\`\`

### 2. Update a Workflow
\`\`\`
get_workflow_definition → get current definition
(modify the definition)
update_workflow → deploy changes
\`\`\`

### 3. Test Changes
\`\`\`
update_workflow → deploy
run_trigger → execute manually
list_run_history → check result
\`\`\`

### 4. Investigate Loop Iterations
\`\`\`
get_run_actions → find the foreach/until action
get_action_repetitions → see each iteration's status
get_action_io with repetitionName → get specific iteration data
\`\`\`

## Tool Selection Tips

| Need | Tool |
|------|------|
| Find runs by date/status | \`search_runs\` |
| Get all runs | \`list_run_history\` |
| See action inputs/outputs | \`get_action_io\` |
| Debug foreach loops | \`get_action_repetitions\` |
| Debug scope blocks | \`get_scope_repetitions\` |
| Check HTTP retries | \`get_action_request_history\` |
| View expression evaluation | \`get_expression_traces\` |
| Check tracked properties | \`get_run_actions\` (includes trackedProperties) |

## Parameters
- \`subscriptionId\`, \`resourceGroupName\`, \`logicAppName\` are always required
- \`workflowName\` is required for Standard SKU only
- Use \`list_subscriptions\` and \`list_logic_apps\` to discover resources
`;

const NATIVE_OPERATIONS_GUIDE = `# Logic Apps Native Operations Reference

This guide covers all built-in Logic Apps operations (no connectors required). Use these schemas when creating or updating workflow definitions.

## Workflow Definition Structure

\`\`\`json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "triggers": { /* trigger definitions */ },
    "actions": { /* action definitions */ },
    "outputs": { /* optional outputs */ }
  }
}
\`\`\`

---

## TRIGGERS

### HTTP Request Trigger (Manual)
Exposes an HTTP endpoint that triggers the workflow.

\`\`\`json
"When_a_HTTP_request_is_received": {
  "type": "Request",
  "kind": "Http",
  "inputs": {
    "schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "id": { "type": "integer" }
      },
      "required": ["name"]
    },
    "method": "POST"
  }
}
\`\`\`

### Recurrence Trigger
Runs on a schedule.

\`\`\`json
"Recurrence": {
  "type": "Recurrence",
  "recurrence": {
    "frequency": "Day",
    "interval": 1,
    "startTime": "2025-01-01T09:00:00Z",
    "timeZone": "Pacific Standard Time",
    "schedule": {
      "hours": ["9", "17"],
      "minutes": ["0", "30"]
    }
  }
}
\`\`\`

Frequency options: "Second", "Minute", "Hour", "Day", "Week", "Month"

---

## DATA OPERATIONS

### Compose
Create or transform data. Output accessed via \`@outputs('Compose')\`.

\`\`\`json
"Compose": {
  "type": "Compose",
  "inputs": {
    "fullName": "@{triggerBody()?['firstName']} @{triggerBody()?['lastName']}",
    "timestamp": "@utcNow()",
    "data": "@triggerBody()"
  },
  "runAfter": {}
}
\`\`\`

### Parse JSON
Parse a JSON string and provide schema for downstream access.

\`\`\`json
"Parse_JSON": {
  "type": "ParseJson",
  "inputs": {
    "content": "@body('HTTP')",
    "schema": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "name": { "type": "string" },
        "items": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  },
  "runAfter": { "HTTP": ["Succeeded"] }
}
\`\`\`

### Select
Transform array items (like map function).

\`\`\`json
"Select": {
  "type": "Select",
  "inputs": {
    "from": "@body('Get_items')?['value']",
    "select": {
      "id": "@item()?['Id']",
      "title": "@item()?['Title']",
      "created": "@item()?['Created']"
    }
  },
  "runAfter": { "Get_items": ["Succeeded"] }
}
\`\`\`

### Filter Array
Filter items based on condition.

\`\`\`json
"Filter_array": {
  "type": "Query",
  "inputs": {
    "from": "@body('Get_items')?['value']",
    "where": "@greater(item()?['Amount'], 100)"
  },
  "runAfter": { "Get_items": ["Succeeded"] }
}
\`\`\`

### Join
Join array elements into a string.

\`\`\`json
"Join": {
  "type": "Join",
  "inputs": {
    "from": "@variables('myArray')",
    "joinWith": ", "
  },
  "runAfter": {}
}
\`\`\`

### Create CSV Table
Convert array to CSV.

\`\`\`json
"Create_CSV_table": {
  "type": "Table",
  "inputs": {
    "from": "@body('Select')",
    "format": "CSV",
    "columns": [
      { "header": "ID", "value": "@item()?['id']" },
      { "header": "Name", "value": "@item()?['name']" }
    ]
  },
  "runAfter": { "Select": ["Succeeded"] }
}
\`\`\`

### Create HTML Table
Convert array to HTML table.

\`\`\`json
"Create_HTML_table": {
  "type": "Table",
  "inputs": {
    "from": "@body('Select')",
    "format": "HTML"
  },
  "runAfter": { "Select": ["Succeeded"] }
}
\`\`\`

---

## VARIABLES

### Initialize Variable
Declare a variable (must be at top level, not in loops).

\`\`\`json
"Initialize_counter": {
  "type": "InitializeVariable",
  "inputs": {
    "variables": [
      {
        "name": "counter",
        "type": "integer",
        "value": 0
      }
    ]
  },
  "runAfter": {}
}
\`\`\`

Types: "string", "integer", "float", "boolean", "array", "object"

### Set Variable
Update variable value.

\`\`\`json
"Set_variable": {
  "type": "SetVariable",
  "inputs": {
    "name": "counter",
    "value": "@add(variables('counter'), 1)"
  },
  "runAfter": {}
}
\`\`\`

### Increment Variable
Add to integer variable.

\`\`\`json
"Increment_variable": {
  "type": "IncrementVariable",
  "inputs": {
    "name": "counter",
    "value": 1
  },
  "runAfter": {}
}
\`\`\`

### Append to Array Variable

\`\`\`json
"Append_to_array": {
  "type": "AppendToArrayVariable",
  "inputs": {
    "name": "myArray",
    "value": "@outputs('Compose')"
  },
  "runAfter": { "Compose": ["Succeeded"] }
}
\`\`\`

### Append to String Variable

\`\`\`json
"Append_to_string": {
  "type": "AppendToStringVariable",
  "inputs": {
    "name": "myString",
    "value": "Additional text"
  },
  "runAfter": {}
}
\`\`\`

---

## CONTROL FLOW

### Condition (If/Else)

\`\`\`json
"Condition": {
  "type": "If",
  "expression": {
    "and": [
      { "greater": ["@triggerBody()?['amount']", 100] },
      { "equals": ["@triggerBody()?['status']", "active"] }
    ]
  },
  "actions": {
    "True_action": {
      "type": "Compose",
      "inputs": "Condition was true",
      "runAfter": {}
    }
  },
  "else": {
    "actions": {
      "False_action": {
        "type": "Compose",
        "inputs": "Condition was false",
        "runAfter": {}
      }
    }
  },
  "runAfter": {}
}
\`\`\`

Expression operators: equals, not, greater, less, greaterOrEquals, lessOrEquals, and, or, contains, startsWith, endsWith, empty

### Switch

\`\`\`json
"Switch": {
  "type": "Switch",
  "expression": "@triggerBody()?['status']",
  "cases": {
    "Case_Active": {
      "case": "active",
      "actions": {
        "Handle_active": {
          "type": "Compose",
          "inputs": "Status is active",
          "runAfter": {}
        }
      }
    },
    "Case_Inactive": {
      "case": "inactive",
      "actions": {
        "Handle_inactive": {
          "type": "Compose",
          "inputs": "Status is inactive",
          "runAfter": {}
        }
      }
    }
  },
  "default": {
    "actions": {
      "Handle_default": {
        "type": "Compose",
        "inputs": "Unknown status",
        "runAfter": {}
      }
    }
  },
  "runAfter": {}
}
\`\`\`

### For Each Loop

\`\`\`json
"For_each": {
  "type": "Foreach",
  "foreach": "@triggerBody()?['items']",
  "actions": {
    "Process_item": {
      "type": "Compose",
      "inputs": {
        "itemId": "@items('For_each')?['id']",
        "itemName": "@items('For_each')?['name']"
      },
      "runAfter": {}
    }
  },
  "runAfter": {},
  "runtimeConfiguration": {
    "concurrency": {
      "repetitions": 20
    }
  }
}
\`\`\`

Set repetitions to 1 for sequential processing.

### Until Loop (Do-While)

\`\`\`json
"Until": {
  "type": "Until",
  "expression": "@equals(variables('counter'), 10)",
  "limit": {
    "count": 60,
    "timeout": "PT1H"
  },
  "actions": {
    "Increment": {
      "type": "IncrementVariable",
      "inputs": { "name": "counter", "value": 1 },
      "runAfter": {}
    }
  },
  "runAfter": { "Initialize_counter": ["Succeeded"] }
}
\`\`\`

### Scope (Group Actions)
Group actions for collective error handling.

\`\`\`json
"Scope": {
  "type": "Scope",
  "actions": {
    "Action1": { "type": "Compose", "inputs": "First", "runAfter": {} },
    "Action2": { "type": "Compose", "inputs": "Second", "runAfter": { "Action1": ["Succeeded"] } }
  },
  "runAfter": {}
}
\`\`\`

### Terminate
End workflow with status.

\`\`\`json
"Terminate": {
  "type": "Terminate",
  "inputs": {
    "runStatus": "Failed",
    "runError": {
      "code": "ValidationFailed",
      "message": "Input validation failed: @{variables('errorMessage')}"
    }
  },
  "runAfter": {}
}
\`\`\`

runStatus options: "Succeeded", "Failed", "Cancelled"

---

## HTTP OPERATIONS

### HTTP Action
Make HTTP requests to any endpoint.

\`\`\`json
"HTTP": {
  "type": "Http",
  "inputs": {
    "method": "POST",
    "uri": "https://api.example.com/data",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer @{variables('token')}"
    },
    "body": {
      "name": "@triggerBody()?['name']",
      "timestamp": "@utcNow()"
    },
    "queries": {
      "api-version": "2023-01-01"
    },
    "retryPolicy": {
      "type": "exponential",
      "count": 3,
      "interval": "PT20S",
      "minimumInterval": "PT10S",
      "maximumInterval": "PT1H"
    }
  },
  "runAfter": {}
}
\`\`\`

Retry types: "none", "fixed", "exponential"

### Response Action
Return HTTP response (for Request trigger workflows).

\`\`\`json
"Response": {
  "type": "Response",
  "kind": "Http",
  "inputs": {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "status": "success",
      "id": "@body('Create_record')?['id']",
      "message": "Record created successfully"
    }
  },
  "runAfter": { "Create_record": ["Succeeded"] }
}
\`\`\`

---

## TIME OPERATIONS

### Delay
Wait for specified duration.

\`\`\`json
"Delay": {
  "type": "Wait",
  "inputs": {
    "interval": {
      "count": 5,
      "unit": "Minute"
    }
  },
  "runAfter": {}
}
\`\`\`

Units: "Second", "Minute", "Hour", "Day", "Week", "Month"

### Delay Until
Wait until specific time.

\`\`\`json
"Delay_until": {
  "type": "Wait",
  "inputs": {
    "until": {
      "timestamp": "@addHours(utcNow(), 2)"
    }
  },
  "runAfter": {}
}
\`\`\`

---

## runAfter Conditions

Controls action execution based on previous action status:

\`\`\`json
"runAfter": {
  "Previous_action": ["Succeeded"]
}
\`\`\`

Status options:
- \`"Succeeded"\` - Run if previous succeeded
- \`"Failed"\` - Run if previous failed
- \`"Skipped"\` - Run if previous was skipped
- \`"TimedOut"\` - Run if previous timed out

Multiple statuses (error handling):
\`\`\`json
"runAfter": {
  "Risky_action": ["Failed", "TimedOut"]
}
\`\`\`

---

## Common Expression Functions

### String Functions
- \`concat('Hello', ' ', 'World')\` → "Hello World"
- \`substring('Hello', 0, 3)\` → "Hel"
- \`replace('Hello', 'l', 'x')\` → "Hexxo"
- \`toLower('HELLO')\` → "hello"
- \`toUpper('hello')\` → "HELLO"
- \`trim('  hello  ')\` → "hello"
- \`split('a,b,c', ',')\` → ["a", "b", "c"]
- \`length('hello')\` → 5

### Array Functions
- \`first(array)\` → first element
- \`last(array)\` → last element
- \`length(array)\` → count of elements
- \`take(array, 3)\` → first 3 elements
- \`skip(array, 2)\` → skip first 2 elements
- \`union(array1, array2)\` → combined unique elements
- \`intersection(array1, array2)\` → common elements
- \`contains(array, 'value')\` → true/false

### Date/Time Functions
- \`utcNow()\` → current UTC time
- \`addDays(timestamp, 5)\` → add 5 days
- \`addHours(timestamp, 2)\` → add 2 hours
- \`addMinutes(timestamp, 30)\` → add 30 minutes
- \`formatDateTime(timestamp, 'yyyy-MM-dd')\` → formatted string
- \`dayOfWeek(timestamp)\` → 0-6 (Sunday=0)
- \`startOfDay(timestamp)\` → midnight of that day

### Conversion Functions
- \`int('123')\` → 123
- \`string(123)\` → "123"
- \`json('{"a":1}')\` → parsed object
- \`bool('true')\` → true
- \`base64('hello')\` → base64 encoded
- \`base64ToString(base64string)\` → decoded string

### Null/Empty Handling
- \`coalesce(value1, value2, 'default')\` → first non-null
- \`if(empty(value), 'default', value)\` → conditional default
- \`@{triggerBody()?['field']}\` → safe navigation with ?

---

## Complete Workflow Example

\`\`\`json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "triggers": {
      "When_a_HTTP_request_is_received": {
        "type": "Request",
        "kind": "Http",
        "inputs": {
          "schema": {
            "type": "object",
            "properties": {
              "items": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "integer" },
                    "name": { "type": "string" },
                    "amount": { "type": "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "actions": {
      "Initialize_total": {
        "type": "InitializeVariable",
        "inputs": {
          "variables": [{ "name": "total", "type": "float", "value": 0 }]
        },
        "runAfter": {}
      },
      "Filter_high_value": {
        "type": "Query",
        "inputs": {
          "from": "@triggerBody()?['items']",
          "where": "@greater(item()?['amount'], 100)"
        },
        "runAfter": { "Initialize_total": ["Succeeded"] }
      },
      "For_each_item": {
        "type": "Foreach",
        "foreach": "@body('Filter_high_value')",
        "actions": {
          "Add_to_total": {
            "type": "SetVariable",
            "inputs": {
              "name": "total",
              "value": "@add(variables('total'), items('For_each_item')?['amount'])"
            },
            "runAfter": {}
          }
        },
        "runAfter": { "Filter_high_value": ["Succeeded"] },
        "runtimeConfiguration": { "concurrency": { "repetitions": 1 } }
      },
      "Response": {
        "type": "Response",
        "kind": "Http",
        "inputs": {
          "statusCode": 200,
          "body": {
            "filteredCount": "@length(body('Filter_high_value'))",
            "total": "@variables('total')"
          }
        },
        "runAfter": { "For_each_item": ["Succeeded"] }
      }
    }
  }
}
\`\`\`
`;

export function registerToolsAndPrompts(mcpServer: McpServer): void {
  // Use underlying server for tools (JSON Schema-based definitions)
  // This is the recommended approach for advanced usage per McpServer docs
  const server = mcpServer.server;

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments ?? {});
  });

  // Register prompts using McpServer's high-level API
  mcpServer.registerPrompt(
    "logic-apps-guide",
    {
      description:
        "System guidance for Azure Logic Apps operations - helps with tool selection and common workflows",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: LOGIC_APPS_GUIDE,
          },
        },
      ],
    })
  );

  mcpServer.registerPrompt(
    "native-operations-guide",
    {
      description:
        "Complete reference for all native Logic Apps operations (triggers, actions, control flow) with JSON schemas and examples. Use this when authoring or modifying workflow definitions.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: NATIVE_OPERATIONS_GUIDE,
          },
        },
      ],
    })
  );
}
