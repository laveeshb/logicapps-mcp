---
version: 0.2.0
lastUpdated: 2025-12-26
---

# Connection Issues

Troubleshooting API connections, authentication, and authorization problems.

**Microsoft Docs:**
- [Managed connectors overview](https://learn.microsoft.com/azure/connectors/managed)
- [Authenticate with Managed Identity](https://learn.microsoft.com/azure/logic-apps/create-managed-service-identity)
- [Built-in connectors (Standard)](https://learn.microsoft.com/azure/connectors/built-in)

## Quick Diagnosis

```
1. get_connections           -- List all connections
2. test_connection           -- Check specific connection health
3. get_connection_details    -- See auth type, status
```

---

## OAuth Errors

### "The browser is closed. Please sign in again"

**Cause:** OAuth consent popup was blocked, closed, or timed out.

**Solution:**
1. Open Azure Portal
2. Navigate to the API Connection resource
3. Click "Edit API connection"
4. Click "Authorize" button
5. Complete OAuth flow in browser
6. Save the connection

**Prevention:** OAuth connections cannot be fully automated via ARM/API. Always requires interactive consent.

### "Consent authorization failed"

**Cause:** User denied consent or lacks permissions for the OAuth app.

**Solution:**
1. Ensure user has required permissions in the target service (e.g., SharePoint, Office 365)
2. Check if admin consent is required for the OAuth app
3. Try authorizing with an admin account

### Token Expired

**Symptom:** 401 errors on connector actions that worked before.

**Solution:**
1. `test_connection` to verify
2. Re-authorize in portal (Edit connection → Authorize)
3. Consider using Managed Identity instead of OAuth where supported

---

## Managed Identity Issues

### "ManagedIdentityCredential authentication unavailable"

**Cause:** Managed Identity not enabled on the Logic App.

**Solution:**
1. Go to Logic App → Identity → System assigned → On
2. Or create User-assigned identity and attach

### "Forbidden" with Managed Identity

**Cause:** Identity lacks permissions on target resource.

**Solution:**
1. Get the identity's Object ID (from Logic App → Identity)
2. Assign appropriate role on target resource:
   - Azure resources: RBAC role assignment
   - Key Vault: Access policy or RBAC
   - Storage: Storage Blob Data Contributor, etc.

### HTTP Action with Managed Identity
```json
{
  "type": "Http",
  "inputs": {
    "method": "GET",
    "uri": "https://management.azure.com/subscriptions/xxx/...",
    "authentication": {
      "type": "ManagedServiceIdentity",
      "audience": "https://management.azure.com/"
    }
  }
}
```

Common audiences:
- Azure Management: `https://management.azure.com/`
- Key Vault: `https://vault.azure.net`
- Storage: `https://storage.azure.com/`
- Graph API: `https://graph.microsoft.com`

---

## Service Principal Errors

### "AADSTS700016: Application not found"

**Cause:** App registration doesn't exist or wrong tenant.

**Solution:**
1. Verify App ID in Azure AD
2. Check you're in the correct tenant
3. Ensure app is not deleted

### "Insufficient privileges"

**Cause:** Service Principal lacks API permissions.

**Solution:**
1. Azure Portal → App registrations → Your app
2. API permissions → Add permissions
3. Grant admin consent if required

---

## Connector-Specific Issues

### SQL Connector

**"Login failed for user"**
- Check SQL server firewall allows Azure services
- Verify username/password
- For Azure SQL: Enable "Allow Azure services" in firewall

**"Cannot open database"**
- Database name is case-sensitive
- Check database exists and is online

### Service Bus

**"Unauthorized access. 'Send' claim required"**
- Connection string needs Send permission
- Or assign Azure Service Bus Data Sender role for Managed Identity

### Blob Storage

**"This request is not authorized"**
- For shared key: Check storage account key is current
- For Managed Identity: Assign Storage Blob Data Contributor role
- For SAS: Check SAS token not expired

### Office 365 / Outlook

**"Mailbox not found"**
- Shared mailboxes need explicit access granted
- Check user has Exchange Online license

---

## Standard SKU (V2) Connections

Standard Logic Apps use V2 connections with different behavior:

### Creating V2 Connections

1. Create connection with `kind: "V2"` via API
2. Connection appears in "Unauthenticated" state
3. User must authorize in Azure Portal
4. Access policy auto-created with `type: "ActiveDirectory"`

### connections.json Format
```json
{
  "managedApiConnections": {
    "office365": {
      "api": { "id": "/subscriptions/.../providers/Microsoft.Web/locations/.../managedApis/office365" },
      "connection": { "id": "/subscriptions/.../providers/Microsoft.Web/connections/office365" },
      "connectionRuntimeUrl": "https://...azure-apim.net/..."
    }
  }
}
```

**Key:** `connectionRuntimeUrl` is required for V2 - this is the runtime endpoint.

### Built-in Connectors (No Connection Needed)

These don't need API connections:
- HTTP (Request/Response)
- Schedule (Recurrence)
- Inline Code (JavaScript)
- Variables
- Control (Condition, ForEach, Until, Switch, Scope)
- Data Operations (Compose, Parse JSON, Select, etc.)

---

## Testing Connections

### Via MCP Tool
```
test_connection(subscriptionId, resourceGroupName, connectionName)
```

Returns: Status, error details if failed.

### Via Azure Portal
1. API Connections → Select connection
2. "Edit API connection" → "Test connection"

### Common Test Results

| Result | Meaning |
|--------|---------|
| "Connected" | Working |
| "Error" + 401 | Auth expired, re-authorize |
| "Error" + 403 | Permission denied |
| "Error" + timeout | Network/firewall issue |
