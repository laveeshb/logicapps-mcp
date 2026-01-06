/**
 * Tools module barrel file.
 */

export { TOOL_DEFINITIONS } from "./definitions.js";
export { handleToolCall } from "./handler.js";

export { listSubscriptions } from "./subscriptions.js";
export type { SubscriptionResult } from "./subscriptions.js";

export { listLogicApps } from "./logicApps.js";
export type { ListLogicAppsResult } from "./logicApps.js";

export {
  listWorkflows,
  getWorkflowDefinition,
  getWorkflowTriggers,
  listWorkflowVersions,
  getWorkflowVersion,
  cloneWorkflow,
} from "./workflows.js";
export type {
  ListWorkflowsResult,
  GetWorkflowDefinitionResult,
  GetWorkflowTriggersResult,
  ListWorkflowVersionsResult,
  GetWorkflowVersionResult,
  CloneWorkflowResult,
} from "./workflows.js";

export { listRunHistory, getRunDetails, getRunActions, getActionIO, searchRuns } from "./runs.js";
export type {
  ListRunHistoryResult,
  GetRunDetailsResult,
  GetRunActionsResult,
  GetActionIOResult,
  SearchRunsResult,
} from "./runs.js";

export { getConnections, getConnectionDetails, testConnection } from "./connections.js";
export type {
  GetConnectionsResult,
  GetConnectionDetailsResult,
  TestConnectionResult,
} from "./connections.js";

export { getTriggerHistory, getTriggerCallbackUrl } from "./triggers.js";
export type { GetTriggerHistoryResult, GetTriggerCallbackUrlResult } from "./triggers.js";

export { getActionRepetitions, getScopeRepetitions } from "./repetitions.js";
export type { GetActionRepetitionsResult, GetScopeRepetitionsResult } from "./repetitions.js";

export { getActionRequestHistory } from "./requestHistory.js";
export type { GetActionRequestHistoryResult } from "./requestHistory.js";

export { getExpressionTraces } from "./expressions.js";
export type { GetExpressionTracesResult } from "./expressions.js";

export { getWorkflowSwagger } from "./swagger.js";
export type { GetWorkflowSwaggerResult } from "./swagger.js";
