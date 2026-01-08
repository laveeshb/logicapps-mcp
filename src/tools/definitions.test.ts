import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS } from "./definitions.js";

describe("tool definitions", () => {
  it("should have all 40 tools with unique names and required schema properties", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(40);
    
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
    
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  // Test required parameters for key tools using parameterized approach
  const toolRequirements: Array<{
    name: string;
    required: string[];
    optional?: string[];
    enums?: Record<string, string[]>;
  }> = [
    { name: "list_subscriptions", required: [] },
    { name: "list_logic_apps", required: ["subscriptionId"], enums: { sku: ["consumption", "standard", "all"] } },
    { name: "list_workflows", required: ["subscriptionId", "resourceGroupName", "logicAppName"] },
    { name: "get_workflow_definition", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["workflowName"] },
    { name: "list_run_history", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["top", "filter"] },
    { name: "get_run_details", required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"] },
    { name: "get_run_actions", required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"], optional: ["actionName"] },
    { name: "get_connections", required: ["subscriptionId", "resourceGroupName"] },
    { name: "get_action_io", required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"], enums: { type: ["inputs", "outputs", "both"] } },
    { name: "search_runs", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["startTime", "endTime"], enums: { status: ["Succeeded", "Failed", "Cancelled", "Running"] } },
    { name: "get_workflow_version", required: ["subscriptionId", "resourceGroupName", "logicAppName", "versionId"] },
    { name: "get_connection_details", required: ["subscriptionId", "resourceGroupName", "connectionName"] },
    { name: "test_connection", required: ["subscriptionId", "resourceGroupName", "connectionName"] },
    { name: "enable_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["workflowName"] },
    { name: "disable_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["workflowName"] },
    { name: "run_trigger", required: ["subscriptionId", "resourceGroupName", "logicAppName", "triggerName"], optional: ["workflowName"] },
    { name: "cancel_run", required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"], optional: ["workflowName"] },
    { name: "resubmit_run", required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"], optional: ["workflowName"] },
    { name: "create_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName", "definition"], optional: ["location", "workflowName", "kind"] },
    { name: "update_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName", "definition"], optional: ["workflowName", "kind"] },
    { name: "delete_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName"], optional: ["workflowName"] },
    { name: "clone_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName", "targetResourceGroupName", "targetLogicAppName", "targetWorkflowName"], optional: ["targetSubscriptionId"], enums: { targetKind: ["Stateful", "Stateless"] } },
    { name: "validate_clone_workflow", required: ["subscriptionId", "resourceGroupName", "logicAppName", "targetResourceGroupName", "targetLogicAppName", "targetWorkflowName"], optional: ["targetSubscriptionId"], enums: { targetKind: ["Stateful", "Stateless"] } },
  ];

  it.each(toolRequirements)("$name should have correct required/optional parameters", ({ name, required, optional, enums }) => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === name);
    expect(tool, `Tool ${name} should be defined`).toBeDefined();
    
    // Check required parameters
    for (const param of required) {
      expect(tool?.inputSchema.required).toContain(param);
    }
    
    // Check optional parameters exist but are not required
    for (const param of optional ?? []) {
      expect(tool?.inputSchema.properties).toHaveProperty(param);
      expect(tool?.inputSchema.required).not.toContain(param);
    }
    
    // Check enum values
    for (const [param, values] of Object.entries(enums ?? {})) {
      const prop = tool?.inputSchema.properties?.[param] as { enum?: string[] };
      expect(prop?.enum).toEqual(values);
    }
  });
});
