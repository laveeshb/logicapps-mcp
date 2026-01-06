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
    it("should throw error when source is not Consumption", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(
        cloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("source must be a Consumption Logic App");
    });

    it("should throw error when target is not Standard", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      // Source is Consumption, Target is also Consumption
      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("consumption");

      await expect(
        cloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("target must be a Standard Logic App");
    });

    it("should throw error when source workflow has no definition", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "target-app.azurewebsites.net",
        masterKey: "test-key",
      });

      // Source workflow without definition
      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: undefined,
        },
      });

      await expect(
        cloneWorkflow(
          "sub-123",
          "source-rg",
          "source-app",
          "target-rg",
          "target-app",
          "target-workflow"
        )
      ).rejects.toThrow("does not have a definition");
    });

    it("should successfully clone workflow with default Stateful kind", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { armRequest, vfsRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "target-app.azurewebsites.net",
        masterKey: "test-key",
      });

      const mockDefinition = {
        $schema: "https://schema.management.azure.com/schemas/2016-06-01/Microsoft.Logic.json",
        triggers: { manual: { type: "Request" } },
        actions: { Response: { type: "Response" } },
      };

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: mockDefinition,
        },
      });

      vi.mocked(vfsRequest).mockResolvedValue(undefined);

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

      // Verify vfsRequest was called with correct parameters
      expect(vfsRequest).toHaveBeenCalledWith(
        "target-app.azurewebsites.net",
        "/admin/vfs/site/wwwroot/target-workflow/workflow.json",
        "test-key",
        expect.objectContaining({
          method: "PUT",
          body: expect.objectContaining({
            definition: mockDefinition,
            kind: "Stateful",
          }),
        })
      );
    });

    it("should clone workflow with Stateless kind when specified", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { armRequest, vfsRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "target-app.azurewebsites.net",
        masterKey: "test-key",
      });

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      vi.mocked(vfsRequest).mockResolvedValue(undefined);

      const result = await cloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        undefined,
        "Stateless"
      );

      expect(result.success).toBe(true);

      expect(vfsRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            kind: "Stateless",
          }),
        })
      );
    });

    it("should use different target subscription when specified", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { armRequest, vfsRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "target-app.azurewebsites.net",
        masterKey: "test-key",
      });

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      vi.mocked(vfsRequest).mockResolvedValue(undefined);

      const result = await cloneWorkflow(
        "source-sub",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        "target-sub"
      );

      expect(result.success).toBe(true);

      // Verify detectLogicAppSku was called with target subscription
      expect(detectLogicAppSku).toHaveBeenNthCalledWith(2, "target-sub", "target-rg", "target-app");
    });
  });

  describe("validateCloneWorkflow", () => {
    it("should return error when source is not Consumption", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("standard")
        .mockResolvedValueOnce("standard");

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Clone is only supported from Consumption Logic Apps to Standard Logic Apps. The source must be a Consumption Logic App."
      );
    });

    it("should return error when target is not Standard", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("consumption");

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Clone target must be a Standard Logic App. The target Logic App must already exist."
      );
    });

    it("should return error when target Logic App not found", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockRejectedValueOnce(new Error("Not found"));

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("not found"))).toBe(true);
    });

    it("should return error for invalid targetKind", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        undefined,
        "InvalidKind"
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid target kind"))).toBe(true);
    });

    it("should return warning when workflow uses API connections", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: {
            $schema: "test",
            triggers: {},
            actions: {
              Send_Email: {
                type: "ApiConnection",
                inputs: {},
              },
            },
          },
        },
      });

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes("API connection"))).toBe(true);
    });

    it("should pass validation for valid clone parameters", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: {
            $schema: "https://schema.management.azure.com/schemas/2016-06-01/Microsoft.Logic.json",
            triggers: { manual: { type: "Request" } },
            actions: { Response: { type: "Response" } },
          },
        },
      });

      const result = await validateCloneWorkflow(
        "sub-123",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow",
        undefined,
        "Stateful"
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sourceWorkflow).toBe("source-app");
      expect(result.targetWorkflow).toBe("target-workflow");
      expect(result.targetLogicApp).toBe("target-app");
      expect(result.message).toContain("Validation passed");
    });

    it("should use source subscription when target subscription not specified", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku)
        .mockResolvedValueOnce("consumption")
        .mockResolvedValueOnce("standard");

      vi.mocked(armRequest).mockResolvedValue({
        name: "source-app",
        properties: {
          definition: { $schema: "test", triggers: {}, actions: {} },
        },
      });

      await validateCloneWorkflow(
        "source-sub",
        "source-rg",
        "source-app",
        "target-rg",
        "target-app",
        "target-workflow"
      );

      // Verify detectLogicAppSku was called with source subscription for target
      expect(detectLogicAppSku).toHaveBeenNthCalledWith(2, "source-sub", "target-rg", "target-app");
    });
  });
});
