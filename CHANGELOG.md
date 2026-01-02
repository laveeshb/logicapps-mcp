# Changelog

## [Unreleased] - 0.3.0

### Added

- Write operations for workflow lifecycle management: `create_workflow`, `update_workflow`, `delete_workflow`, `enable_workflow`, `disable_workflow`
- Connector tools: `get_connector_swagger`, `invoke_connector_operation`, `create_connection`, `test_connection`
- Knowledge tools for AI guidance: `get_troubleshooting_guide`, `get_authoring_guide`, `get_reference`, `get_workflow_instructions`
- Retry logic with exponential backoff and jitter in HTTP client
- Integration tests for Azure API calls
- ESLint and Prettier configuration
- Parameter validation for `createConnection()`

### Changed

- Simplified cloud deployment to pure MCP server with passthrough authentication
- Migrated from deprecated `Server` class to `McpServer`
- Renamed internal Flowie references to LogicAppsMcp

### Fixed

- Add timeout (30s) and size limits (10MB) to `fetchContentLink()`
- Improve `armRequest` type safety for empty responses
- Fix `searchRuns()` pagination with `clientTrackingId` filter
- Add `UnsupportedOperation` to `McpErrorCode` type
- Apply `top` parameter limit to `getTriggerHistory` for Standard SKU
- Handle VFS 412/409 conflict errors with specific error code
- Improve `withConcurrency` robustness
- Handle both SKUs gracefully in workflow operations

### Performance

- Parallelize API calls in `getConnectorSwagger()`
- Cache SKU detection and Standard app access results with configurable TTL

## [0.2.0] - 2025-12-24

### Added

- 5 new tools for enhanced workflow debugging:
  - `get_action_repetitions` - Debug foreach/until loop iterations
  - `get_scope_repetitions` - Debug scope/switch/condition executions
  - `get_action_request_history` - View HTTP request/response history
  - `get_expression_traces` - Debug workflow expression evaluations
  - `get_workflow_swagger` - Get OpenAPI spec for workflow triggers

## [0.1.0] - 2025-12-23

### Added

- Initial release of Azure Logic Apps MCP Server
- Support for both Consumption and Standard Logic App SKUs
- Core tools:
  - `list_subscriptions` - Discover Azure subscriptions
  - `list_logic_apps` - List Logic Apps in subscription/resource group
  - `list_workflows` - List workflows in Standard Logic Apps
  - `get_workflow_definition` - Retrieve workflow JSON definition
  - `get_workflow_triggers` - Get trigger information
  - `list_run_history` - View workflow run history
  - `get_run_details` - Get run-level details and errors
  - `get_run_actions` - List all actions in a run
  - `get_action_io` - Get action inputs/outputs
  - `get_connections` - List API connections
  - `get_connection_details` - Get connection status and details
  - `search_runs` - Search runs by status, time, or tracking ID
  - `get_trigger_history` - View trigger execution history
  - `get_trigger_callback_url` - Get request trigger URLs
  - `run_trigger` - Manually invoke triggers
  - `cancel_run` - Cancel running workflow instances
  - `get_host_status` - Get Standard SKU runtime status
  - `list_workflow_versions` - List workflow versions (Consumption)
  - `get_workflow_version` - Get specific version definition
- Dual deployment modes: stdio (local) and HTTP (Azure Functions)
- Azure authentication via Azure CLI or service principal

[Unreleased]: https://github.com/laveeshb/logicapps-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/laveeshb/logicapps-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/laveeshb/logicapps-mcp/releases/tag/v0.1.0
