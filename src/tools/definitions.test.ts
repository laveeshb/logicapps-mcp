import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS } from "./definitions.js";

describe("tool definitions", () => {
  it("should have all 26 tools defined", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(26);
  });

  it("should have unique tool names", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("should have required tool schema properties", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  describe("list_subscriptions", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "list_subscriptions");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should have no required parameters", () => {
      expect(tool?.inputSchema.required).toEqual([]);
    });
  });

  describe("list_logic_apps", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "list_logic_apps");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
    });

    it("should have sku enum property", () => {
      const skuProp = tool?.inputSchema.properties?.sku as {
        enum?: string[];
      };
      expect(skuProp?.enum).toEqual(["consumption", "standard", "all"]);
    });
  });

  describe("list_workflows", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "list_workflows");

    it("should require subscriptionId, resourceGroupName, and logicAppName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
    });
  });

  describe("get_workflow_definition", () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.name === "get_workflow_definition"
    );

    it("should have optional workflowName parameter", () => {
      expect(tool?.inputSchema.properties?.workflowName).toBeDefined();
      expect(tool?.inputSchema.required).not.toContain("workflowName");
    });
  });

  describe("list_run_history", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "list_run_history");

    it("should have top and filter parameters", () => {
      expect(tool?.inputSchema.properties?.top).toBeDefined();
      expect(tool?.inputSchema.properties?.filter).toBeDefined();
    });
  });

  describe("get_run_details", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_run_details");

    it("should require runId", () => {
      expect(tool?.inputSchema.required).toContain("runId");
    });
  });

  describe("get_run_actions", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_run_actions");

    it("should have optional actionName parameter", () => {
      expect(tool?.inputSchema.properties?.actionName).toBeDefined();
      expect(tool?.inputSchema.required).not.toContain("actionName");
    });
  });

  describe("get_connections", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_connections");

    it("should require subscriptionId and resourceGroupName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
    });
  });

  describe("get_action_io", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_action_io");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId, resourceGroupName, logicAppName, runId, and actionName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
      expect(tool?.inputSchema.required).toContain("runId");
      expect(tool?.inputSchema.required).toContain("actionName");
    });

    it("should have optional type parameter with enum", () => {
      expect(tool?.inputSchema.properties?.type).toBeDefined();
      const typeProperty = tool?.inputSchema.properties?.type as { enum?: string[] };
      expect(typeProperty?.enum).toEqual(["inputs", "outputs", "both"]);
    });
  });

  describe("search_runs", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "search_runs");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId, resourceGroupName, and logicAppName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
    });

    it("should have optional status parameter with enum", () => {
      const statusProperty = tool?.inputSchema.properties?.status as { enum?: string[] };
      expect(statusProperty?.enum).toEqual(["Succeeded", "Failed", "Cancelled", "Running"]);
    });

    it("should have optional time range parameters", () => {
      expect(tool?.inputSchema.properties?.startTime).toBeDefined();
      expect(tool?.inputSchema.properties?.endTime).toBeDefined();
    });
  });

  describe("get_workflow_version", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_workflow_version");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require versionId", () => {
      expect(tool?.inputSchema.required).toContain("versionId");
    });
  });

  describe("get_connection_details", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "get_connection_details");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require connectionName", () => {
      expect(tool?.inputSchema.required).toContain("connectionName");
    });
  });

  describe("test_connection", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "test_connection");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require connectionName", () => {
      expect(tool?.inputSchema.required).toContain("connectionName");
    });
  });

  // Write Operations
  describe("enable_workflow", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "enable_workflow");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId, resourceGroupName, and logicAppName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
    });

    it("should have optional workflowName parameter", () => {
      expect(tool?.inputSchema.properties).toHaveProperty("workflowName");
      expect(tool?.inputSchema.required).not.toContain("workflowName");
    });
  });

  describe("disable_workflow", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "disable_workflow");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId, resourceGroupName, and logicAppName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
    });

    it("should have optional workflowName parameter", () => {
      expect(tool?.inputSchema.properties).toHaveProperty("workflowName");
      expect(tool?.inputSchema.required).not.toContain("workflowName");
    });
  });

  describe("run_trigger", () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === "run_trigger");

    it("should be defined", () => {
      expect(tool).toBeDefined();
    });

    it("should require subscriptionId, resourceGroupName, logicAppName, and triggerName", () => {
      expect(tool?.inputSchema.required).toContain("subscriptionId");
      expect(tool?.inputSchema.required).toContain("resourceGroupName");
      expect(tool?.inputSchema.required).toContain("logicAppName");
      expect(tool?.inputSchema.required).toContain("triggerName");
    });

    it("should have optional workflowName parameter", () => {
      expect(tool?.inputSchema.properties).toHaveProperty("workflowName");
      expect(tool?.inputSchema.required).not.toContain("workflowName");
    });
  });
});
