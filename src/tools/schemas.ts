/**
 * Zod validation schemas for all MCP tool parameters.
 * Provides runtime validation with clear error messages.
 */

import { z } from "zod";

// ============================================================================
// Common field validators
// ============================================================================

/** Azure subscription ID - UUID format */
const subscriptionId = z.string().min(1, "subscriptionId is required");

/** Azure resource group name */
const resourceGroupName = z.string().min(1, "resourceGroupName is required");

/** Logic App resource name */
const logicAppName = z.string().min(1, "logicAppName is required");

/** Workflow name (required for Standard SKU) */
const workflowName = z.string().min(1);

/** Workflow run ID */
const runId = z.string().min(1, "runId is required");

/** Action name within a workflow */
const actionName = z.string().min(1, "actionName is required");

/** Trigger name */
const triggerName = z.string().min(1, "triggerName is required");

/** Connection name */
const connectionName = z.string().min(1, "connectionName is required");

/** Azure region/location */
const location = z.string().min(1, "location is required");

// ============================================================================
// Discovery tools
// ============================================================================

export const listSubscriptionsSchema = z.object({});

export const listLogicAppsSchema = z.object({
  subscriptionId,
  resourceGroupName: z.string().optional(),
  sku: z.enum(["consumption", "standard", "all"]).optional(),
});

export const listWorkflowsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
});

export const getHostStatusSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
});

// ============================================================================
// Workflow definition tools
// ============================================================================

export const getWorkflowDefinitionSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const getWorkflowTriggersSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const getWorkflowSwaggerSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const listWorkflowVersionsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  top: z.number().int().min(1).max(100).optional(),
});

export const getWorkflowVersionSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  versionId: z.string().min(1, "versionId is required"),
});

// ============================================================================
// Run history tools
// ============================================================================

export const listRunHistorySchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
  top: z.number().int().min(1).max(100).optional(),
  filter: z.string().optional(),
  skipToken: z.string().optional(),
});

export const getRunDetailsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  workflowName: workflowName.optional(),
});

export const getRunActionsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  workflowName: workflowName.optional(),
  actionName: z.string().optional(),
});

export const getActionIOSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  actionName,
  workflowName: workflowName.optional(),
  type: z.enum(["inputs", "outputs", "both"]).optional(),
});

export const searchRunsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
  status: z.enum(["Succeeded", "Failed", "Cancelled", "Running"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  clientTrackingId: z.string().optional(),
  top: z.number().int().min(1).max(100).optional(),
  skipToken: z.string().optional(),
});

export const cancelRunSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  workflowName: workflowName.optional(),
});

export const resubmitRunSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  workflowName: workflowName.optional(),
});

// ============================================================================
// Trigger tools
// ============================================================================

export const getTriggerHistorySchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  triggerName,
  workflowName: workflowName.optional(),
  top: z.number().int().min(1).max(100).optional(),
  filter: z.string().optional(),
});

export const getTriggerCallbackUrlSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  triggerName,
  workflowName: workflowName.optional(),
});

export const runTriggerSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  triggerName,
  workflowName: workflowName.optional(),
});

// ============================================================================
// Action debugging tools
// ============================================================================

export const getActionRepetitionsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  actionName,
  workflowName: workflowName.optional(),
  repetitionName: z.string().optional(),
});

export const getScopeRepetitionsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  actionName,
  workflowName: workflowName.optional(),
});

export const getActionRequestHistorySchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  actionName,
  workflowName: workflowName.optional(),
  requestHistoryName: z.string().optional(),
});

export const getExpressionTracesSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  runId,
  actionName,
  workflowName: workflowName.optional(),
});

// ============================================================================
// Connection tools
// ============================================================================

export const getConnectionsSchema = z.object({
  subscriptionId,
  resourceGroupName,
});

export const getConnectionDetailsSchema = z.object({
  subscriptionId,
  resourceGroupName,
  connectionName,
});

export const testConnectionSchema = z.object({
  subscriptionId,
  resourceGroupName,
  connectionName,
});

export const createConnectionSchema = z.object({
  subscriptionId,
  resourceGroupName,
  connectionName,
  connectorName: z.string().min(1, "connectorName is required"),
  location,
  displayName: z.string().optional(),
  parameterValues: z.record(z.string(), z.unknown()).optional(),
});

export const getConnectorSwaggerSchema = z.object({
  subscriptionId,
  location,
  connectorName: z.string().min(1, "connectorName is required"),
});

export const invokeConnectorOperationSchema = z.object({
  subscriptionId,
  resourceGroupName,
  connectionName,
  operationId: z.string().min(1, "operationId is required"),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Write operations
// ============================================================================

export const enableWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const disableWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const createWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  definition: z.object({}).passthrough(), // Allow any workflow definition structure
  location: z.string().optional(),
  workflowName: workflowName.optional(),
  kind: z.enum(["Stateful", "Stateless"]).optional(),
  connections: z
    .record(
      z.string(),
      z.object({
        connectionName: z.string(),
        id: z.string(),
      })
    )
    .optional(),
});

export const updateWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  definition: z.object({}).passthrough(),
  workflowName: workflowName.optional(),
  kind: z.enum(["Stateful", "Stateless"]).optional(),
  connections: z
    .record(
      z.string(),
      z.object({
        connectionName: z.string(),
        id: z.string(),
      })
    )
    .optional(),
});

export const deleteWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  workflowName: workflowName.optional(),
});

export const cloneWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  targetResourceGroupName: z.string().min(1, "targetResourceGroupName is required"),
  targetLogicAppName: z.string().min(1, "targetLogicAppName is required"),
  targetWorkflowName: z.string().min(1, "targetWorkflowName is required"),
  targetSubscriptionId: z.string().optional(),
  targetKind: z.enum(["Stateful", "Stateless"]).optional(),
});

export const validateCloneWorkflowSchema = z.object({
  subscriptionId,
  resourceGroupName,
  logicAppName,
  targetResourceGroupName: z.string().min(1, "targetResourceGroupName is required"),
  targetLogicAppName: z.string().min(1, "targetLogicAppName is required"),
  targetWorkflowName: z.string().min(1, "targetWorkflowName is required"),
  targetSubscriptionId: z.string().optional(),
  targetKind: z.enum(["Stateful", "Stateless"]).optional(),
});

// ============================================================================
// Knowledge tools
// ============================================================================

export const getTroubleshootingGuideSchema = z.object({
  topic: z.enum(["expression-errors", "connection-issues", "run-failures", "known-limitations"]),
});

export const getAuthoringGuideSchema = z.object({
  topic: z.enum(["workflow-patterns", "connector-patterns", "deployment"]),
});

export const getReferenceSchema = z.object({
  topic: z.enum(["tool-catalog", "sku-differences"]),
});

export const getWorkflowInstructionsSchema = z.object({
  topic: z.enum([
    "diagnose-failures",
    "explain-workflow",
    "monitor-workflows",
    "create-workflow",
    "fix-workflow",
  ]),
});

// ============================================================================
// Schema registry for handler lookup
// ============================================================================

export const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  list_subscriptions: listSubscriptionsSchema,
  list_logic_apps: listLogicAppsSchema,
  list_workflows: listWorkflowsSchema,
  get_host_status: getHostStatusSchema,
  get_workflow_definition: getWorkflowDefinitionSchema,
  get_workflow_triggers: getWorkflowTriggersSchema,
  get_workflow_swagger: getWorkflowSwaggerSchema,
  list_workflow_versions: listWorkflowVersionsSchema,
  get_workflow_version: getWorkflowVersionSchema,
  list_run_history: listRunHistorySchema,
  get_run_details: getRunDetailsSchema,
  get_run_actions: getRunActionsSchema,
  get_action_io: getActionIOSchema,
  search_runs: searchRunsSchema,
  cancel_run: cancelRunSchema,
  resubmit_run: resubmitRunSchema,
  get_trigger_history: getTriggerHistorySchema,
  get_trigger_callback_url: getTriggerCallbackUrlSchema,
  run_trigger: runTriggerSchema,
  get_action_repetitions: getActionRepetitionsSchema,
  get_scope_repetitions: getScopeRepetitionsSchema,
  get_action_request_history: getActionRequestHistorySchema,
  get_expression_traces: getExpressionTracesSchema,
  get_connections: getConnectionsSchema,
  get_connection_details: getConnectionDetailsSchema,
  test_connection: testConnectionSchema,
  create_connection: createConnectionSchema,
  get_connector_swagger: getConnectorSwaggerSchema,
  invoke_connector_operation: invokeConnectorOperationSchema,
  enable_workflow: enableWorkflowSchema,
  disable_workflow: disableWorkflowSchema,
  create_workflow: createWorkflowSchema,
  update_workflow: updateWorkflowSchema,
  delete_workflow: deleteWorkflowSchema,
  clone_workflow: cloneWorkflowSchema,
  validate_clone_workflow: validateCloneWorkflowSchema,
  get_troubleshooting_guide: getTroubleshootingGuideSchema,
  get_authoring_guide: getAuthoringGuideSchema,
  get_reference: getReferenceSchema,
  get_workflow_instructions: getWorkflowInstructionsSchema,
};

/**
 * Validate tool arguments against the schema.
 * Returns the validated and typed arguments.
 * Throws ZodError if validation fails.
 */
export function validateToolArgs<T>(toolName: string, args: Record<string, unknown>): T {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    throw new Error(`No schema defined for tool: ${toolName}`);
  }
  return schema.parse(args) as T;
}
