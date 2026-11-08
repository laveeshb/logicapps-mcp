/**
 * Which tools are available in read-only mode.
 *
 * Every tool has to be listed here. A test fails when a tool in
 * TOOL_DEFINITIONS is missing, so a new tool gets classified when it is added.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * "read" tools are available in read-only mode. "restricted" tools change or
 * run something in Azure, or return a credential, and are hidden.
 */
export type ToolAccess = "read" | "restricted";

export const TOOL_ACCESS: Record<string, ToolAccess> = {
  // Discovery
  list_subscriptions: "read",
  list_logic_apps: "read",
  list_workflows: "read",

  // Inspection
  get_workflow_definition: "read",
  get_workflow_triggers: "read",
  get_workflow_swagger: "read",
  list_workflow_versions: "read",
  get_workflow_version: "read",
  get_host_status: "read",

  // Run history and debugging
  list_run_history: "read",
  search_runs: "read",
  get_run_details: "read",
  get_run_actions: "read",
  get_action_io: "read",
  get_action_repetitions: "read",
  get_scope_repetitions: "read",
  get_expression_traces: "read",
  get_action_request_history: "read",
  get_trigger_history: "read",

  // Connections and connectors (test_connection only probes the connection)
  get_connections: "read",
  get_connection_details: "read",
  test_connection: "read",
  get_connector_swagger: "read",

  // Checks only, nothing is created
  validate_clone_workflow: "read",

  // Knowledge
  get_troubleshooting_guide: "read",
  get_authoring_guide: "read",
  get_reference: "read",
  get_workflow_instructions: "read",

  // Create, change or delete
  create_workflow: "restricted",
  update_workflow: "restricted",
  delete_workflow: "restricted",
  clone_workflow: "restricted",
  enable_workflow: "restricted",
  disable_workflow: "restricted",
  create_connection: "restricted",

  // Run something
  run_trigger: "restricted",
  cancel_run: "restricted",
  resubmit_run: "restricted",
  invoke_connector_operation: "restricted",

  // The signed URL it returns can start the workflow
  get_trigger_callback_url: "restricted",
};

/**
 * True when the tool may be used. Tools that are not listed are treated as
 * restricted in read-only mode.
 */
export function isToolAllowed(name: string, readOnly: boolean): boolean {
  return !readOnly || TOOL_ACCESS[name] === "read";
}

/**
 * The tools to list for the given mode.
 */
export function getAvailableTools(tools: Tool[], readOnly: boolean): Tool[] {
  return tools.filter((tool) => isToolAllowed(tool.name, readOnly));
}

/**
 * Say on stderr that read-only mode is on and how many tools are available.
 */
export function logReadOnlyMode(tools: Tool[], readOnly: boolean): void {
  if (!readOnly) return;
  const available = getAvailableTools(tools, true).length;
  console.error(`Read-only mode: ${available} of ${tools.length} tools available`);
}
