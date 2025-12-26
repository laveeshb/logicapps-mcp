# Troubleshooting Guide

Quick reference for common Logic Apps issues. Each section links to detailed docs.

## Quick Diagnosis

| Symptom | Likely Cause | Start Here |
|---------|--------------|------------|
| Run shows "Failed" | Action threw error | [Run Failures](run-failures.md) |
| Expression returns null/error | Syntax or null reference | [Expression Errors](expression-errors.md) |
| Trigger not firing | Connection, config, or data issue | [Run Failures](run-failures.md#trigger-not-firing) |
| "Unauthorized" / "Forbidden" | Auth/connection problem | [Connection Issues](connection-issues.md) |
| "The browser is closed" | OAuth popup blocked | [Connection Issues](connection-issues.md#oauth-errors) |
| Loop hangs or times out | Delay/Until behavior | [Run Failures](run-failures.md#loop-issues) |
| Can't do X in Logic Apps | Platform limitation | [Known Limitations](known-limitations.md) |

## Debugging Workflow

```
1. search_runs (status=Failed, time filter)
      ↓
2. get_run_details (error summary)
      ↓
3. get_run_actions (find failed action)
      ↓
4. get_action_io (see actual data)
      ↓
5. If expression error: get_expression_traces
   If loop error: get_action_repetitions
   If connection error: test_connection
```

## Error Code Quick Reference

| Error | Meaning | Action |
|-------|---------|--------|
| 400 BadRequest | Invalid input/schema | Check request body/schema |
| 401 Unauthorized | Auth failed | Re-authorize connection |
| 403 Forbidden | No permission | Check RBAC/API permissions |
| 404 NotFound | Resource missing | Verify endpoint/path |
| 409 Conflict | Resource state conflict | Check if resource is locked |
| 429 TooManyRequests | Rate limited | Add retry policy |
| 500 InternalServerError | Service error | Retry, check status page |
| 502 BadGateway | Upstream service error | Check external service |
| 504 GatewayTimeout | Request timed out | Increase timeout, optimize |

## Detailed Guides

- [Expression Errors](expression-errors.md) - Null checks, type conversions, JSON parsing
- [Connection Issues](connection-issues.md) - OAuth, Managed Identity, API connections
- [Run Failures](run-failures.md) - Failed actions, triggers, loops, timeouts
- [Known Limitations](known-limitations.md) - Platform constraints and workarounds
