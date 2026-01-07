import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloneWorkflow, validateCloneWorkflow } from "./workflows.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
  armRequestVoid: vi.fn(),
  armRequestAllPages: vi.fn(),
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
});
