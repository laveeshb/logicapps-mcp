# Expression Errors

Common expression issues and how to fix them.

## Debugging Expressions

Use `get_expression_traces` to see exactly how expressions evaluated at runtime:
```
get_expression_traces(subscriptionId, resourceGroupName, logicAppName, runId, actionName)
```

Returns: expression text, evaluated result, any errors.

---

## Null Reference Errors

**Problem:** `InvalidTemplate` or action fails because a property doesn't exist.

**Root cause:** Accessing a property on null/undefined object.

### Solutions

**Use optional chaining (`?`):**
```
@body('Http')?['data']?['items']?[0]?['name']
```
Each `?` returns null instead of error if parent is null.

**Check for null explicitly:**
```
@if(equals(body('Http')?['field'], null), 'default', body('Http')['field'])
```

**Use coalesce for defaults:**
```
@coalesce(body('Http')?['field'], 'fallback value')
@coalesce(triggerBody()?['priority'], 'normal')
```

**Condition before access:**
```json
{
  "type": "If",
  "expression": { "@not": { "@equals": [ "@body('Http')?['data']", null ] } },
  "actions": { "Process_Data": { ... } }
}
```

---

## Type Conversion Errors

**Problem:** Type mismatch - expected string, got object (or vice versa).

### String to JSON
```
@json(body('GetContent'))                    -- Parse JSON string
@json(triggerBody())                         -- Parse trigger body
```

### JSON to String
```
@string(body('GetRecord'))                   -- Convert object to string
@{body('GetRecord')}                         -- Interpolation (implicit string)
```

### Numeric Conversions
```
@int(triggerBody()['count'])                 -- String to integer
@float(body('Calculate')['value'])           -- String to float
@string(variables('counter'))                -- Number to string
```

### Boolean
```
@bool('true')                                -- String to boolean
@if(equals(body('Check')['active'], true), 'yes', 'no')
```

---

## Array Handling

**Problem:** Expected array, got single object (or vice versa).

### Access array elements
```
@body('GetItems')[0]                         -- First element
@body('GetItems')[length(body('GetItems'))-1] -- Last element
@first(body('GetItems'))                     -- First (null-safe)
@last(body('GetItems'))                      -- Last (null-safe)
```

### Check if array
```
@if(equals(length(body('GetItems')), 0), 'empty', 'has items')
```

### Wrap single item as array
```
@createArray(body('GetItem'))
```

### Flatten nested arrays
```
@union(body('Array1'), body('Array2'))       -- Merge arrays
```

---

## Base64 Encoding/Decoding

**Problem:** Binary content handling for blobs, files, attachments.

### Encode to Base64
```
@base64(body('GetBlob'))                     -- Binary to base64
@base64(string(body('GetContent')))          -- String to base64
```

### Decode from Base64
```
@base64ToString(body('GetMessage'))          -- Base64 to string
@base64ToBinary(body('GetAttachment'))       -- Base64 to binary
```

### File content for email attachments
```json
{
  "Attachments": [{
    "Name": "@{body('Get_blob_metadata')?['Name']}",
    "ContentBytes": "@{body('Get_blob_content')['$content']}"
  }]
}
```

---

## Date/Time Expressions

### Current time
```
@utcNow()                                    -- Current UTC time
@utcNow('yyyy-MM-dd')                        -- Formatted date
@convertFromUtc(utcNow(), 'Pacific Standard Time')
```

### Date arithmetic
```
@addDays(utcNow(), 7)                        -- Add 7 days
@addHours(utcNow(), -2)                      -- Subtract 2 hours
@addMinutes(triggerBody()['startTime'], 30)
```

### Comparisons
```
@greater(ticks(utcNow()), ticks(body('Task')['dueDate']))
@less(utcNow(), addDays(variables('deadline'), -1))
```

### Parsing dates
```
@parseDateTime(body('Record')['dateString'], 'en-US')
@formatDateTime(body('Record')['timestamp'], 'yyyy-MM-ddTHH:mm:ssZ')
```

---

## Accessing Trigger/Workflow Data

### HTTP Trigger inputs
```
@triggerBody()                               -- Request body
@triggerOutputs()['headers']['Content-Type'] -- Request header
@triggerOutputs()['queries']['paramName']    -- Query parameter
@triggerOutputs()['relativePathParameters']['id'] -- URL path param
```

### Workflow metadata
```
@workflow().name                             -- Workflow name
@workflow().run.name                         -- Current run ID
@workflow().tags                             -- Resource tags
@actions('ActionName')                       -- Action outputs
@result('ScopeName')                         -- All outputs from scope
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `@body('action')['field']` on null | `@body('action')?['field']` |
| Comparing string "null" to null | `@equals(body('x')['f'], null)` not `@equals(body('x')['f'], 'null')` |
| JSON in string context | Use `@json()` to parse first |
| Array where object expected | Access `[0]` or use `@first()` |
| Integer division truncation | Use `@div(float(a), float(b))` |
