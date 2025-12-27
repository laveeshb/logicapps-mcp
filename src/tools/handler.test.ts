import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleToolCall } from "./handler.js";

// Mock all tool implementations
vi.mock("./subscriptions.js", () => ({
  listSubscriptions: vi.fn(),
}));

vi.mock("./logicApps.js", () => ({
  listLogicApps: vi.fn(),
}));

vi.mock("./workflows.js", () => ({
  listWorkflows: vi.fn(),
  getWorkflowDefinition: vi.fn(),
  getWorkflowTriggers: vi.fn(),
}));

vi.mock("./runs.js", () => ({
  listRunHistory: vi.fn(),
  getRunDetails: vi.fn(),
  getRunActions: vi.fn(),
}));

vi.mock("./connections.js", () => ({
  getConnections: vi.fn(),
}));

import { listSubscriptions } from "./subscriptions.js";
import { listLogicApps } from "./logicApps.js";
import {
  listWorkflows,
  getWorkflowDefinition,
  getWorkflowTriggers,
} from "./workflows.js";
import { listRunHistory, getRunDetails, getRunActions } from "./runs.js";
import { getConnections } from "./connections.js";

describe("handleToolCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call listSubscriptions for list_subscriptions tool", async () => {
    const mockResult = {
      subscriptions: [{ subscriptionId: "123", displayName: "Test", state: "Enabled" }],
    };
    vi.mocked(listSubscriptions).mockResolvedValue(mockResult);

    const result = await handleToolCall("list_subscriptions", {});

    expect(listSubscriptions).toHaveBeenCalled();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(mockResult);
  });

  it("should call listLogicApps with correct parameters", async () => {
    const mockResult = { logicApps: [] };
    vi.mocked(listLogicApps).mockResolvedValue(mockResult);

    await handleToolCall("list_logic_apps", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      sku: "consumption",
    });

    expect(listLogicApps).toHaveBeenCalledWith("sub-123", "rg-test", "consumption");
  });

  it("should call listWorkflows with correct parameters", async () => {
    const mockResult = { workflows: [] };
    vi.mocked(listWorkflows).mockResolvedValue(mockResult);

    await handleToolCall("list_workflows", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
    });

    expect(listWorkflows).toHaveBeenCalledWith("sub-123", "rg-test", "my-app");
  });

  it("should call getWorkflowDefinition with optional workflowName", async () => {
    const mockResult = { definition: { $schema: "", contentVersion: "" } };
    vi.mocked(getWorkflowDefinition).mockResolvedValue(mockResult);

    await handleToolCall("get_workflow_definition", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
      workflowName: "my-workflow",
    });

    expect(getWorkflowDefinition).toHaveBeenCalledWith(
      "sub-123",
      "rg-test",
      "my-app",
      "my-workflow"
    );
  });

  it("should call getWorkflowTriggers", async () => {
    const mockResult = { triggers: [] };
    vi.mocked(getWorkflowTriggers).mockResolvedValue(mockResult);

    await handleToolCall("get_workflow_triggers", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
    });

    expect(getWorkflowTriggers).toHaveBeenCalledWith(
      "sub-123",
      "rg-test",
      "my-app",
      undefined
    );
  });

  it("should call listRunHistory with optional parameters", async () => {
    const mockResult = { runs: [] };
    vi.mocked(listRunHistory).mockResolvedValue(mockResult);

    await handleToolCall("list_run_history", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
      top: 50,
      filter: "status eq 'Failed'",
    });

    expect(listRunHistory).toHaveBeenCalledWith(
      "sub-123",
      "rg-test",
      "my-app",
      undefined,
      50,
      "status eq 'Failed'",
      undefined
    );
  });

  it("should call getRunDetails with runId", async () => {
    const mockResult = {
      run: {
        id: "run-123",
        name: "run-123",
        status: "Succeeded",
        startTime: "2024-01-01T00:00:00Z",
        trigger: { name: "manual" },
      },
    };
    vi.mocked(getRunDetails).mockResolvedValue(mockResult);

    await handleToolCall("get_run_details", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
      runId: "run-123",
    });

    expect(getRunDetails).toHaveBeenCalledWith(
      "sub-123",
      "rg-test",
      "my-app",
      "run-123",
      undefined
    );
  });

  it("should call getRunActions with optional actionName", async () => {
    const mockResult = { actions: [] };
    vi.mocked(getRunActions).mockResolvedValue(mockResult);

    await handleToolCall("get_run_actions", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
      logicAppName: "my-app",
      runId: "run-123",
      actionName: "Send_Email",
    });

    expect(getRunActions).toHaveBeenCalledWith(
      "sub-123",
      "rg-test",
      "my-app",
      "run-123",
      undefined,
      "Send_Email"
    );
  });

  it("should call getConnections", async () => {
    const mockResult = { connections: [] };
    vi.mocked(getConnections).mockResolvedValue(mockResult);

    await handleToolCall("get_connections", {
      subscriptionId: "sub-123",
      resourceGroupName: "rg-test",
    });

    expect(getConnections).toHaveBeenCalledWith("sub-123", "rg-test");
  });

  it("should return error for unknown tool", async () => {
    const result = await handleToolCall("unknown_tool", {});

    expect(result.isError).toBe(true);
    const content = result.content[0] as { text: string };
    const error = JSON.parse(content.text);
    expect(error.error.code).toBe("InvalidTool");
    expect(error.error.message).toContain("unknown_tool");
  });

  it("should handle tool errors gracefully", async () => {
    vi.mocked(listSubscriptions).mockRejectedValue(new Error("API Error"));

    const result = await handleToolCall("list_subscriptions", {});

    expect(result.isError).toBe(true);
    const content = result.content[0] as { text: string };
    const error = JSON.parse(content.text);
    expect(error.error.code).toBe("UnknownError");
    expect(error.error.message).toBe("API Error");
  });
});
