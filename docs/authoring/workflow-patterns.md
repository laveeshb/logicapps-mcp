---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Workflow Patterns

Common workflow patterns with copy-paste examples.

---

## Trigger Patterns

### HTTP Request Trigger

Exposes an HTTPS endpoint that can be called externally.

```json
{
  "triggers": {
    "manual": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "schema": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "email": { "type": "string" }
          },
          "required": ["name"]
        }
      }
    }
  }
}
```

With relative path (REST-style):
```json
{
  "triggers": {
    "manual": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "GET",
        "relativePath": "/users/{userId}/orders/{orderId}"
      }
    }
  }
}
```

Access path parameters: `@triggerOutputs()['relativePathParameters']['userId']`

### Recurrence (Scheduled)

```json
{
  "triggers": {
    "Recurrence": {
      "type": "Recurrence",
      "recurrence": {
        "frequency": "Day",
        "interval": 1,
        "schedule": {
          "hours": ["9", "17"],
          "minutes": ["0"]
        },
        "timeZone": "Pacific Standard Time"
      }
    }
  }
}
```

Frequencies: `Month`, `Week`, `Day`, `Hour`, `Minute`, `Second`

### Sliding Window

For catching up on missed runs:
```json
{
  "triggers": {
    "Sliding_Window": {
      "type": "SlidingWindow",
      "recurrence": {
        "frequency": "Hour",
        "interval": 1
      }
    }
  }
}
```

---

## Response Patterns

### HTTP Response

Required for HTTP-triggered workflows that need to return data:

```json
{
  "actions": {
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
          "data": "@body('Process_Data')"
        }
      },
      "runAfter": {
        "Process_Data": ["Succeeded"]
      }
    }
  }
}
```

### Conditional Response

```json
{
  "actions": {
    "Condition": {
      "type": "If",
      "expression": {
        "and": [{ "equals": ["@body('Validate')?['isValid']", true] }]
      },
      "actions": {
        "Success_Response": {
          "type": "Response",
          "inputs": { "statusCode": 200, "body": { "status": "ok" } }
        }
      },
      "else": {
        "actions": {
          "Error_Response": {
            "type": "Response",
            "inputs": { "statusCode": 400, "body": { "error": "Validation failed" } }
          }
        }
      },
      "runAfter": { "Validate": ["Succeeded"] }
    }
  }
}
```

---

## Control Flow

### Condition (If-Else)

```json
{
  "Condition": {
    "type": "If",
    "expression": {
      "and": [
        { "greater": ["@triggerBody()?['amount']", 1000] },
        { "equals": ["@triggerBody()?['priority']", "high"] }
      ]
    },
    "actions": {
      "High_Value_Path": { "type": "Compose", "inputs": "High value order" }
    },
    "else": {
      "actions": {
        "Normal_Path": { "type": "Compose", "inputs": "Normal order" }
      }
    }
  }
}
```

### Switch

```json
{
  "Switch": {
    "type": "Switch",
    "expression": "@triggerBody()?['orderType']",
    "cases": {
      "Case_New": {
        "case": "new",
        "actions": { "Create_Order": { ... } }
      },
      "Case_Update": {
        "case": "update",
        "actions": { "Update_Order": { ... } }
      },
      "Case_Cancel": {
        "case": "cancel",
        "actions": { "Cancel_Order": { ... } }
      }
    },
    "default": {
      "actions": { "Unknown_Type": { ... } }
    }
  }
}
```

### ForEach Loop

```json
{
  "For_each_item": {
    "type": "Foreach",
    "foreach": "@body('Get_Items')",
    "actions": {
      "Process_Item": {
        "type": "Http",
        "inputs": {
          "method": "POST",
          "uri": "https://api.example.com/process",
          "body": "@items('For_each_item')"
        }
      }
    },
    "runtimeConfiguration": {
      "concurrency": { "repetitions": 20 }
    }
  }
}
```

Sequential (one at a time):
```json
"operationOptions": "Sequential",
"runtimeConfiguration": { "concurrency": { "repetitions": 1 } }
```

### Until Loop

```json
{
  "Until_Complete": {
    "type": "Until",
    "expression": "@equals(body('Check_Status')?['status'], 'complete')",
    "limit": {
      "count": 60,
      "timeout": "PT1H"
    },
    "actions": {
      "Check_Status": {
        "type": "Http",
        "inputs": {
          "method": "GET",
          "uri": "https://api.example.com/status/@{variables('jobId')}"
        }
      },
      "Wait": {
        "type": "Wait",
        "inputs": {
          "interval": { "count": 30, "unit": "Second" }
        },
        "runAfter": { "Check_Status": ["Succeeded"] }
      }
    }
  }
}
```

---

## Error Handling

### Try-Catch Pattern with Scope

```json
{
  "Try_Scope": {
    "type": "Scope",
    "actions": {
      "Call_External_API": { ... },
      "Process_Response": { ... }
    }
  },
  "Catch_Scope": {
    "type": "Scope",
    "runAfter": {
      "Try_Scope": ["Failed", "TimedOut"]
    },
    "actions": {
      "Log_Error": {
        "type": "Compose",
        "inputs": {
          "error": "@result('Try_Scope')",
          "timestamp": "@utcNow()"
        }
      },
      "Send_Alert": {
        "type": "Http",
        "inputs": {
          "method": "POST",
          "uri": "https://hooks.slack.com/...",
          "body": {
            "text": "Workflow failed: @{result('Try_Scope')[0]['error']['message']}"
          }
        },
        "runAfter": { "Log_Error": ["Succeeded"] }
      }
    }
  },
  "Finally_Action": {
    "type": "Compose",
    "runAfter": {
      "Try_Scope": ["Succeeded", "Failed", "TimedOut", "Skipped"],
      "Catch_Scope": ["Succeeded", "Skipped"]
    },
    "inputs": "Workflow complete"
  }
}
```

### Retry Policy

```json
{
  "Call_API": {
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
}
```

Types:
- `none` - No retry
- `fixed` - Fixed interval between retries
- `exponential` - Exponential backoff

---

## Variables

### Initialize Variable

```json
{
  "Initialize_Counter": {
    "type": "InitializeVariable",
    "inputs": {
      "variables": [{
        "name": "counter",
        "type": "integer",
        "value": 0
      }]
    },
    "runAfter": {}
  }
}
```

Types: `string`, `integer`, `float`, `boolean`, `array`, `object`

### Set/Increment/Append

```json
{
  "Set_Variable": {
    "type": "SetVariable",
    "inputs": { "name": "result", "value": "@body('Calculate')" }
  },
  "Increment_Counter": {
    "type": "IncrementVariable",
    "inputs": { "name": "counter", "value": 1 }
  },
  "Append_To_Array": {
    "type": "AppendToArrayVariable",
    "inputs": { "name": "items", "value": "@body('GetItem')" }
  }
}
```

---

## Data Operations

### Compose

Create data inline:
```json
{
  "Compose_Output": {
    "type": "Compose",
    "inputs": {
      "orderId": "@triggerBody()?['id']",
      "processedAt": "@utcNow()",
      "total": "@add(body('GetOrder')?['subtotal'], body('GetOrder')?['tax'])"
    }
  }
}
```

### Parse JSON

Convert string to typed JSON:
```json
{
  "Parse_JSON": {
    "type": "ParseJson",
    "inputs": {
      "content": "@body('Get_Raw_Data')",
      "schema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "items": {
            "type": "array",
            "items": { "type": "object" }
          }
        }
      }
    }
  }
}
```

### Select (Map/Transform)

```json
{
  "Select_Items": {
    "type": "Select",
    "inputs": {
      "from": "@body('Get_Orders')",
      "select": {
        "OrderId": "@item()?['id']",
        "CustomerName": "@item()?['customer']?['name']",
        "Total": "@item()?['total']"
      }
    }
  }
}
```

### Filter

```json
{
  "Filter_High_Value": {
    "type": "Query",
    "inputs": {
      "from": "@body('Get_Orders')",
      "where": "@greater(item()?['total'], 1000)"
    }
  }
}
```

---

## HTTP Actions

### Basic HTTP Request

```json
{
  "HTTP_GET": {
    "type": "Http",
    "inputs": {
      "method": "GET",
      "uri": "https://api.example.com/data",
      "headers": {
        "Authorization": "Bearer @{body('Get_Token')?['access_token']}"
      },
      "queries": {
        "page": "1",
        "limit": "100"
      }
    }
  }
}
```

### POST with Body

```json
{
  "HTTP_POST": {
    "type": "Http",
    "inputs": {
      "method": "POST",
      "uri": "https://api.example.com/orders",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "customerId": "@triggerBody()?['customerId']",
        "items": "@body('Get_Cart_Items')"
      }
    }
  }
}
```

### Form-Encoded POST

```json
{
  "Get_Token": {
    "type": "Http",
    "inputs": {
      "method": "POST",
      "uri": "https://login.example.com/oauth/token",
      "headers": {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      "body": "grant_type=client_credentials&client_id=@{encodeUriComponent(parameters('clientId'))}&client_secret=@{encodeUriComponent(parameters('clientSecret'))}"
    }
  }
}
```
