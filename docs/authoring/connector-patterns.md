---
version: 0.2.0
lastUpdated: 2025-12-26
---

# Connector Patterns

Examples for common connectors. Use `get_connector_swagger` for full operation details.

**Microsoft Docs:**
- [Managed connectors list](https://learn.microsoft.com/azure/connectors/managed)
- [Built-in connectors (Standard)](https://learn.microsoft.com/azure/connectors/built-in)
- [Create API connections](https://learn.microsoft.com/azure/logic-apps/logic-apps-create-api-connection)

---

## SKU Connection Differences

| SKU | Connection Type | Notes |
|-----|-----------------|-------|
| **Consumption** | V1 API connections | `$connections` parameter in definition |
| **Standard** | V2 managed + built-in | `connectionRuntimeUrl` required; built-in connectors don't need API connections |

**Standard built-in connectors** (no API connection needed): HTTP, Service Bus, Event Hub, Azure Blob, SQL, Azure Functions

See [SKU Differences](../reference/sku-differences.md#connections) for full details.

---

## Discovery Workflow

Before using a connector:

```
1. get_connector_swagger(connectorName, location)
   → Returns operations, schemas, parameters

2. get_connections(resourceGroupName)
   → Check if connection exists

3. If missing:
   create_connection(connectorName, connectionName, location, parameterValues?)
   → For OAuth: Returns consent link, user must authorize

4. invoke_connector_operation(connectionName, operationId, parameters?)
   → Get dynamic values (tables, queues, folders)

5. Build action using discovered schema
```

---

## SQL Server

### List Tables
```
invoke_connector_operation('sql-connection', 'GetTables')
```

### Get Table Schema
```
invoke_connector_operation('sql-connection', 'GetTable', { table: 'dbo.Orders' })
```

### Get Rows

```json
{
  "Get_Orders": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['sql']['connectionId']" }
      },
      "method": "get",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('default'))}/tables/@{encodeURIComponent(encodeURIComponent('[dbo].[Orders]'))}/items",
      "queries": {
        "$filter": "Status eq 'Pending'",
        "$top": 100
      }
    }
  }
}
```

### Insert Row

```json
{
  "Insert_Order": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['sql']['connectionId']" }
      },
      "method": "post",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('default'))}/tables/@{encodeURIComponent(encodeURIComponent('[dbo].[Orders]'))}/items",
      "body": {
        "CustomerId": "@triggerBody()?['customerId']",
        "OrderDate": "@utcNow()",
        "Status": "New"
      }
    }
  }
}
```

### Execute Stored Procedure

```json
{
  "Execute_Stored_Procedure": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['sql']['connectionId']" }
      },
      "method": "post",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('default'))}/procedures/@{encodeURIComponent(encodeURIComponent('[dbo].[ProcessOrder]'))}",
      "body": {
        "OrderId": "@body('Insert_Order')?['Id']"
      }
    }
  }
}
```

---

## Service Bus

### Send Message to Queue

```json
{
  "Send_Message": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['servicebus']['connectionId']" }
      },
      "method": "post",
      "path": "/@{encodeURIComponent(encodeURIComponent('orders'))}/messages",
      "body": {
        "ContentData": "@{base64(body('Compose_Message'))}",
        "ContentType": "application/json",
        "Label": "order-created",
        "MessageId": "@{guid()}",
        "SessionId": "@{triggerBody()?['customerId']}"
      }
    }
  }
}
```

### Receive from Queue (Trigger)

```json
{
  "triggers": {
    "When_a_message_is_received": {
      "type": "ApiConnection",
      "inputs": {
        "host": {
          "connection": { "name": "@parameters('$connections')['servicebus']['connectionId']" }
        },
        "method": "get",
        "path": "/@{encodeURIComponent(encodeURIComponent('orders'))}/messages/head",
        "queries": {
          "queueType": "Main"
        }
      },
      "recurrence": {
        "frequency": "Minute",
        "interval": 1
      }
    }
  }
}
```

### Complete Message

```json
{
  "Complete_Message": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['servicebus']['connectionId']" }
      },
      "method": "delete",
      "path": "/@{encodeURIComponent(encodeURIComponent('orders'))}/messages/complete",
      "queries": {
        "lockToken": "@triggerBody()?['LockToken']",
        "queueType": "Main"
      }
    }
  }
}
```

---

## Blob Storage

### List Blobs

```json
{
  "List_Blobs": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['azureblob']['connectionId']" }
      },
      "method": "get",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('AccountNameFromSettings'))}/foldersV2/@{encodeURIComponent(encodeURIComponent('JTJmY29udGFpbmVyLW5hbWU='))}",
      "queries": {
        "nextPageMarker": "",
        "useFlatListing": false
      }
    }
  }
}
```

### Get Blob Content

```json
{
  "Get_Blob_Content": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['azureblob']['connectionId']" }
      },
      "method": "get",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('AccountNameFromSettings'))}/files/@{encodeURIComponent(encodeURIComponent('/container/path/file.json'))}/content"
    }
  }
}
```

### Create Blob

```json
{
  "Create_Blob": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['azureblob']['connectionId']" }
      },
      "method": "post",
      "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('AccountNameFromSettings'))}/files",
      "queries": {
        "folderPath": "/container/output",
        "name": "@{guid()}.json",
        "queryParametersSingleEncoded": true
      },
      "body": "@body('Compose_Output')"
    }
  }
}
```

### Blob Trigger

```json
{
  "triggers": {
    "When_a_blob_is_added": {
      "type": "ApiConnection",
      "inputs": {
        "host": {
          "connection": { "name": "@parameters('$connections')['azureblob']['connectionId']" }
        },
        "method": "get",
        "path": "/v2/datasets/@{encodeURIComponent(encodeURIComponent('AccountNameFromSettings'))}/triggers/onupdatedfile",
        "queries": {
          "folderId": "JTJmaW5wdXQ=",
          "maxFileCount": 10
        }
      },
      "recurrence": {
        "frequency": "Minute",
        "interval": 5
      }
    }
  }
}
```

---

## Office 365 / Outlook

### Send Email

```json
{
  "Send_Email": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['office365']['connectionId']" }
      },
      "method": "post",
      "path": "/v2/Mail",
      "body": {
        "To": "@triggerBody()?['email']",
        "Subject": "Order Confirmation - @{body('Get_Order')?['orderId']}",
        "Body": "<p>Your order has been confirmed.</p><p>Total: $@{body('Get_Order')?['total']}</p>",
        "Importance": "Normal"
      }
    }
  }
}
```

### Send Email with Attachment

```json
{
  "Send_Email_With_Attachment": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['office365']['connectionId']" }
      },
      "method": "post",
      "path": "/v2/Mail",
      "body": {
        "To": "user@example.com",
        "Subject": "Report Attached",
        "Body": "Please find the report attached.",
        "Attachments": [
          {
            "Name": "@{body('Get_Blob_Metadata')?['Name']}",
            "ContentBytes": "@{body('Get_Blob_Content')['$content']}"
          }
        ]
      }
    }
  }
}
```

### Email Trigger (When new email arrives)

```json
{
  "triggers": {
    "When_a_new_email_arrives": {
      "type": "ApiConnection",
      "inputs": {
        "host": {
          "connection": { "name": "@parameters('$connections')['office365']['connectionId']" }
        },
        "method": "get",
        "path": "/v2/Mail/OnNewEmail",
        "queries": {
          "folderPath": "Inbox",
          "importance": "Any",
          "fetchOnlyWithAttachment": false,
          "includeAttachments": true
        }
      },
      "recurrence": {
        "frequency": "Minute",
        "interval": 3
      }
    }
  }
}
```

---

## SharePoint

### Get List Items

```json
{
  "Get_Items": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['sharepointonline']['connectionId']" }
      },
      "method": "get",
      "path": "/datasets/@{encodeURIComponent(encodeURIComponent('https://contoso.sharepoint.com/sites/teamsite'))}/tables/@{encodeURIComponent(encodeURIComponent('Tasks'))}/items",
      "queries": {
        "$filter": "Status eq 'Active'",
        "$top": 100
      }
    }
  }
}
```

### Create List Item

```json
{
  "Create_Item": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": { "name": "@parameters('$connections')['sharepointonline']['connectionId']" }
      },
      "method": "post",
      "path": "/datasets/@{encodeURIComponent(encodeURIComponent('https://contoso.sharepoint.com/sites/teamsite'))}/tables/@{encodeURIComponent(encodeURIComponent('Tasks'))}/items",
      "body": {
        "Title": "@triggerBody()?['title']",
        "AssignedTo": "@triggerBody()?['assignee']",
        "DueDate": "@addDays(utcNow(), 7)",
        "Status": "Not Started"
      }
    }
  }
}
```

---

## HTTP (Built-in)

No connection required.

### GET with Auth

```json
{
  "Call_API": {
    "type": "Http",
    "inputs": {
      "method": "GET",
      "uri": "https://api.example.com/data",
      "headers": {
        "Authorization": "Bearer @{body('Get_Token')?['access_token']}",
        "Accept": "application/json"
      },
      "retryPolicy": {
        "type": "exponential",
        "count": 3,
        "interval": "PT10S"
      }
    }
  }
}
```

### Managed Identity Auth

```json
{
  "Call_Azure_API": {
    "type": "Http",
    "inputs": {
      "method": "GET",
      "uri": "https://management.azure.com/subscriptions/@{parameters('subscriptionId')}/resourceGroups?api-version=2021-04-01",
      "authentication": {
        "type": "ManagedServiceIdentity",
        "audience": "https://management.azure.com/"
      }
    }
  }
}
```

---

## Connection Parameters Reference

When creating connections with `create_connection`:

### SQL Server
```json
{
  "server": "myserver.database.windows.net",
  "database": "mydb",
  "username": "admin",
  "password": "...",
  "encryptConnection": true
}
```

### Service Bus
```json
{
  "connectionString": "Endpoint=sb://mynamespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=..."
}
```

### Blob Storage (Key)
```json
{
  "accountName": "mystorageaccount",
  "accessKey": "..."
}
```

### OAuth Connectors (Office 365, Dynamics, etc.)
- No parameters needed for creation
- Returns consent link
- User must authorize in browser

---

## Standard SKU: Service Provider Connectors (Built-in)

Standard Logic Apps include **built-in connectors** that run in-process with higher performance. These use `serviceProviderConnections` instead of managed API connections.

### Key Differences from Managed Connectors

| Aspect | Managed API Connection | Service Provider (Built-in) |
|--------|------------------------|----------------------------|
| Where defined | Separate Azure resource | In `connections.json` file |
| Action type | `ApiConnection` | `ServiceProvider` |
| Auth | Connection resource | App settings / Managed Identity |
| Performance | HTTP to connector service | In-process, higher throughput |

### connections.json Structure

Standard Logic Apps have a `connections.json` file at the root:

```json
{
  "managedApiConnections": {
    "office365": { ... }
  },
  "serviceProviderConnections": {
    "AzureBlob": {
      "parameterValues": {
        "connectionString": "@appsetting('AzureWebJobsStorage')"
      },
      "serviceProvider": {
        "id": "/serviceProviders/AzureBlob"
      },
      "displayName": "Azure Blob (built-in)"
    },
    "serviceBus": {
      "parameterValues": {
        "connectionString": "@appsetting('ServiceBusConnection')"
      },
      "serviceProvider": {
        "id": "/serviceProviders/serviceBus"
      },
      "displayName": "Service Bus (built-in)"
    },
    "sql": {
      "parameterValues": {
        "connectionString": "@appsetting('SqlConnectionString')"
      },
      "serviceProvider": {
        "id": "/serviceProviders/sql"
      },
      "displayName": "SQL Server (built-in)"
    }
  }
}
```

### Built-in Service Bus (Standard)

```json
{
  "Send_Message_Builtin": {
    "type": "ServiceProvider",
    "inputs": {
      "parameters": {
        "entityName": "orders",
        "message": {
          "contentData": "@triggerBody()",
          "contentType": "application/json",
          "messageId": "@{guid()}",
          "sessionId": "@{triggerBody()?['customerId']}"
        }
      },
      "serviceProviderConfiguration": {
        "connectionName": "serviceBus",
        "operationId": "sendMessage",
        "serviceProviderId": "/serviceProviders/serviceBus"
      }
    }
  }
}
```

### Built-in Azure Blob (Standard)

```json
{
  "Read_Blob_Builtin": {
    "type": "ServiceProvider",
    "inputs": {
      "parameters": {
        "containerName": "data",
        "blobName": "@triggerBody()?['fileName']"
      },
      "serviceProviderConfiguration": {
        "connectionName": "AzureBlob",
        "operationId": "readBlob",
        "serviceProviderId": "/serviceProviders/AzureBlob"
      }
    }
  }
}
```

### Built-in SQL (Standard)

```json
{
  "Execute_Query_Builtin": {
    "type": "ServiceProvider",
    "inputs": {
      "parameters": {
        "query": "SELECT * FROM Orders WHERE Status = @Status",
        "queryParameters": {
          "Status": "@triggerBody()?['status']"
        }
      },
      "serviceProviderConfiguration": {
        "connectionName": "sql",
        "operationId": "executeQuery",
        "serviceProviderId": "/serviceProviders/sql"
      }
    }
  }
}
```

### When to Use Built-in vs Managed

**Use Built-in (Service Provider) when:**
- High throughput needed (thousands of messages/second)
- Lower latency required (in-process execution)
- Using Standard SKU
- Connecting to: Service Bus, Event Hub, Azure Blob, SQL, Cosmos DB

**Use Managed API Connection when:**
- Using Consumption SKU
- Connecting to SaaS services (Office 365, Salesforce, Dynamics)
- Need OAuth-based authentication
- Built-in connector not available
