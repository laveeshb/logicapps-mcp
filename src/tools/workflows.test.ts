import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cloneWorkflow,
  validateCloneWorkflow,
  listWorkflows,
  getWorkflowDefinition,
  getWorkflowTriggers,
  listWorkflowVersions,
} from "./workflows.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
  armRequestVoid: vi.fn(),
  vfsRequest: vi.fn(),
  workflowMgmtRequest: vi.fn(),
}));

// Mock the shared module
vi.mock("./shared.js", () => ({
  detectLogicAppSku: vi.fn(),
  getStandardAppAccess: vi.fn(),
}));

describe("workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cloneWorkflow", () => {
    it("should call official clone API with correct request body", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      const result = await cloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.success).toBe(true);
      expect(result.sourceWorkflow).toBe("source-app");
      expect(result.targetWorkflow).toBe("target-workflow");
      expect(result.targetLogicApp).toBe("target-app");

      // Verify armRequestVoid was called with correct clone API endpoint
      expect(armRequestVoid).toHaveBeenCalledWith(
        "/subscriptions/sub-123/resourceGroups/source-rg/providers/Microsoft.Logic/workflows/source-app/clone",
        expect.objectContaining({
          method: "POST",
          queryParams: { "api-version": "2019-05-01" },
          body: {
            target: {
              resourceGroup: {
                id: "/subscriptions/sub-123/resourceGroups/target-rg",
              },
              app: {
                id: "/subscriptions/sub-123/resourceGroups/target-rg/providers/Microsoft.Web/sites/target-app",
              },
              workflowName: "target-workflow",
              kind: "Stateful",
            },
          },
        })
      );
    });

    it("should use Stateless kind when specified", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      await cloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        undefined,
        "Stateless"
      );

      expect(armRequestVoid).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            target: expect.objectContaining({
              kind: "Stateless",
            }),
          }),
        })
      );
    });

    it("should use different target subscription when specified", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      await cloneWorkflow(
        "source-sub",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        "target-sub"
      );

      // Verify target subscription is used in the request body
      expect(armRequestVoid).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            target: expect.objectContaining({
              resourceGroup: {
                id: "/subscriptions/target-sub/resourceGroups/target-rg",
              },
              app: {
                id: "/subscriptions/target-sub/resourceGroups/target-rg/providers/Microsoft.Web/sites/target-app",
              },
            }),
          }),
        })
      );
    });

    it("should propagate errors from clone API", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockRejectedValue(
        new Error("Clone target must be a Standard Logic App")
      );

      await expect(
        cloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("Clone target must be a Standard Logic App");
    });

    it("should propagate error when source is not Consumption", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockRejectedValue(
        new Error("Clone is only supported from Consumption Logic Apps")
      );

      await expect(
        cloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("Clone is only supported from Consumption Logic Apps");
    });
  });

  describe("validateCloneWorkflow", () => {
    it("should call official validateClone API with correct request body", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.isValid).toBe(true);
      expect(result.sourceWorkflow).toBe("source-app");
      expect(result.targetWorkflow).toBe("target-workflow");
      expect(result.targetLogicApp).toBe("target-app");
      expect(result.message).toContain("Validation passed");

      // Verify armRequestVoid was called with correct validateClone API endpoint
      expect(armRequestVoid).toHaveBeenCalledWith(
        "/subscriptions/sub-123/resourceGroups/source-rg/providers/Microsoft.Logic/workflows/source-app/validateClone",
        expect.objectContaining({
          method: "POST",
          queryParams: { "api-version": "2019-05-01" },
          body: {
            target: {
              resourceGroup: {
                id: "/subscriptions/sub-123/resourceGroups/target-rg",
              },
              app: {
                id: "/subscriptions/sub-123/resourceGroups/target-rg/providers/Microsoft.Web/sites/target-app",
              },
              workflowName: "target-workflow",
              kind: "Stateful",
            },
          },
        })
      );
    });

    it("should use Stateless kind when specified", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        undefined,
        "Stateless"
      );

      expect(armRequestVoid).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            target: expect.objectContaining({
              kind: "Stateless",
            }),
          }),
        })
      );
    });

    it("should use different target subscription when specified", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockResolvedValue(undefined);

      await validateCloneWorkflow(
        "source-sub",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        "target-sub"
      );

      // Verify target subscription is used in the request body
      expect(armRequestVoid).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            target: expect.objectContaining({
              resourceGroup: {
                id: "/subscriptions/target-sub/resourceGroups/target-rg",
              },
              app: {
                id: "/subscriptions/target-sub/resourceGroups/target-rg/providers/Microsoft.Web/sites/target-app",
              },
            }),
          }),
        })
      );
    });

    it("should propagate errors from validateClone API", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockRejectedValue(
        new Error("Source workflow not found")
      );

      await expect(
        validateCloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("Source workflow not found");
    });

    it("should propagate error when target workflow already exists", async () => {
      const { armRequestVoid } = await import("../utils/http.js");

      vi.mocked(armRequestVoid).mockRejectedValue(
        new Error("Target workflow already exists")
      );

      await expect(
        validateCloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "existing-workflow"
        )
      ).rejects.toThrow("Target workflow already exists");
    });
  });

  describe("listWorkflows", () => {
    it("should list workflows for Consumption SKU (single workflow)", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        name: "myapp",
        properties: {
          state: "Enabled",
          createdTime: "2024-01-01T00:00:00Z",
          changedTime: "2024-01-02T00:00:00Z",
        },
      });

      const result = await listWorkflows("sub-123", "rg", "myapp");

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].name).toBe("myapp");
      expect(result.workflows[0].state).toBe("Enabled");
      expect(result.workflows[0].createdTime).toBe("2024-01-01T00:00:00Z");
    });

    it("should list workflows for Standard SKU (multiple workflows)", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue([
        { name: "workflow1", kind: "Stateful", isDisabled: false },
        { name: "workflow2", kind: "Stateless", isDisabled: true },
        { name: "workflow3", kind: "Stateful", isDisabled: false },
      ]);

      const result = await listWorkflows("sub-123", "rg", "myapp");

      expect(result.workflows).toHaveLength(3);
      expect(result.workflows[0].name).toBe("workflow1");
      expect(result.workflows[0].state).toBe("Enabled");
      expect(result.workflows[0].kind).toBe("Stateful");
      expect(result.workflows[1].name).toBe("workflow2");
      expect(result.workflows[1].state).toBe("Disabled");
      expect(result.workflows[1].kind).toBe("Stateless");
    });

    it("should handle empty workflow list for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue([]);

      const result = await listWorkflows("sub-123", "rg", "myapp");

      expect(result.workflows).toHaveLength(0);
    });
  });

  describe("getWorkflowDefinition", () => {
    it("should get definition for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        properties: {
          definition: {
            $schema: "https://schema.management.azure.com/schemas/logicapp.json",
            triggers: { manual: { type: "Request" } },
            actions: { Response: { type: "Response" } },
          },
          parameters: { $connections: { value: {} } },
        },
      });

      const result = await getWorkflowDefinition("sub-123", "rg", "myapp");

      expect(result.definition).toBeDefined();
      expect(result.definition.$schema).toContain("logicapp");
      expect(result.definition.triggers).toHaveProperty("manual");
      expect(result.parameters).toBeDefined();
    });

    it("should get definition for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        definition: {
          $schema: "https://schema.management.azure.com/schemas/logicapp.json",
          triggers: { When_a_HTTP_request_is_received: { type: "Request" } },
          actions: { Compose: { type: "Compose" } },
        },
      });

      const result = await getWorkflowDefinition("sub-123", "rg", "myapp", "workflow1");

      expect(result.definition).toBeDefined();
      expect(result.definition.triggers).toHaveProperty("When_a_HTTP_request_is_received");
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(getWorkflowDefinition("sub-123", "rg", "myapp")).rejects.toThrow(
        "workflowName is required for Standard Logic Apps"
      );
    });
  });

  describe("getWorkflowTriggers", () => {
    it("should get triggers for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        value: [
          {
            name: "manual",
            type: "Request",
            properties: {
              state: "Enabled",
              lastExecutionTime: "2024-01-01T00:00:00Z",
              nextExecutionTime: null,
            },
          },
          {
            name: "Recurrence",
            type: "Recurrence",
            properties: {
              state: "Enabled",
              lastExecutionTime: "2024-01-01T00:00:00Z",
              nextExecutionTime: "2024-01-02T00:00:00Z",
            },
          },
        ],
      });

      const result = await getWorkflowTriggers("sub-123", "rg", "myapp");

      expect(result.triggers).toHaveLength(2);
      expect(result.triggers[0].name).toBe("manual");
      expect(result.triggers[0].type).toBe("Request");
      expect(result.triggers[0].state).toBe("Enabled");
      expect(result.triggers[1].name).toBe("Recurrence");
      expect(result.triggers[1].nextExecutionTime).toBe("2024-01-02T00:00:00Z");
    });

    it("should get triggers for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      // Standard SKU returns triggers as object on workflow, not as value array
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        name: "workflow1",
        isDisabled: false,
        triggers: {
          When_a_HTTP_request_is_received: {
            type: "Request",
          },
        },
      });

      const result = await getWorkflowTriggers("sub-123", "rg", "myapp", "workflow1");

      expect(result.triggers).toHaveLength(1);
      expect(result.triggers[0].name).toBe("When_a_HTTP_request_is_received");
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(getWorkflowTriggers("sub-123", "rg", "myapp")).rejects.toThrow(
        "workflowName is required for Standard Logic Apps"
      );
    });

    it("should handle empty triggers list", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({ value: [] });

      const result = await getWorkflowTriggers("sub-123", "rg", "myapp");

      expect(result.triggers).toHaveLength(0);
    });
  });

  describe("listWorkflowVersions", () => {
    it("should list versions for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        value: [
          {
            name: "08585123456789",
            properties: {
              createdTime: "2024-01-01T00:00:00Z",
              changedTime: "2024-01-01T00:00:00Z",
              state: "Enabled",
            },
          },
          {
            name: "08585123456788",
            properties: {
              createdTime: "2024-01-02T00:00:00Z",
              changedTime: "2024-01-02T00:00:00Z",
              state: "Enabled",
            },
          },
        ],
      });

      const result = await listWorkflowVersions("sub-123", "rg", "myapp");

      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe("08585123456789");
      expect(result.versions[0].createdTime).toBe("2024-01-01T00:00:00Z");
    });

    it("should throw error for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(listWorkflowVersions("sub-123", "rg", "myapp")).rejects.toThrow(
        "Workflow versions are only available for Consumption Logic Apps"
      );
    });

    it("should handle empty versions list", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({ value: [] });

      const result = await listWorkflowVersions("sub-123", "rg", "myapp");

      expect(result.versions).toHaveLength(0);
    });
  });
});
