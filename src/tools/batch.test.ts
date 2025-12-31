import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelRuns, batchEnableWorkflows, batchDisableWorkflows } from "./batch.js";

// Mock the underlying operations
vi.mock("./runs.js", () => ({
  cancelRun: vi.fn(),
}));

vi.mock("./workflows.js", () => ({
  enableWorkflow: vi.fn(),
  disableWorkflow: vi.fn(),
}));

describe("batch operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cancelRuns", () => {
    it("should cancel multiple runs successfully", async () => {
      const { cancelRun } = await import("./runs.js");
      const mockCancelRun = vi.mocked(cancelRun);
      mockCancelRun.mockResolvedValue({ success: true, message: "Cancelled" });

      const result = await cancelRuns(
        "sub-123",
        "rg",
        "myapp",
        ["run-1", "run-2", "run-3"],
        undefined,
        5
      );

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.success)).toBe(true);
      expect(mockCancelRun).toHaveBeenCalledTimes(3);
    });

    it("should handle partial failures", async () => {
      const { cancelRun } = await import("./runs.js");
      const mockCancelRun = vi.mocked(cancelRun);
      mockCancelRun
        .mockResolvedValueOnce({ success: true, message: "Cancelled" })
        .mockRejectedValueOnce(new Error("Run not found"))
        .mockResolvedValueOnce({ success: true, message: "Cancelled" });

      const result = await cancelRuns("sub-123", "rg", "myapp", ["run-1", "run-2", "run-3"]);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);

      const failedResult = result.results.find((r) => !r.success);
      expect(failedResult?.error).toContain("Run not found");
    });

    it("should pass workflowName for Standard SKU", async () => {
      const { cancelRun } = await import("./runs.js");
      const mockCancelRun = vi.mocked(cancelRun);
      mockCancelRun.mockResolvedValue({ success: true, message: "Cancelled" });

      await cancelRuns("sub-123", "rg", "myapp", ["run-1"], "workflow1");

      expect(mockCancelRun).toHaveBeenCalledWith(
        "sub-123",
        "rg",
        "myapp",
        "run-1",
        "workflow1"
      );
    });

    it("should handle empty run array", async () => {
      const result = await cancelRuns("sub-123", "rg", "myapp", []);

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe("batchEnableWorkflows", () => {
    it("should enable multiple workflows successfully", async () => {
      const { enableWorkflow } = await import("./workflows.js");
      const mockEnableWorkflow = vi.mocked(enableWorkflow);
      mockEnableWorkflow.mockResolvedValue({ success: true, message: "Enabled" });

      const result = await batchEnableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["workflow1", "workflow2"]
      );

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockEnableWorkflow).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures", async () => {
      const { enableWorkflow } = await import("./workflows.js");
      const mockEnableWorkflow = vi.mocked(enableWorkflow);
      mockEnableWorkflow
        .mockResolvedValueOnce({ success: true, message: "Enabled" })
        .mockRejectedValueOnce(new Error("Workflow not found"));

      const result = await batchEnableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["workflow1", "workflow2"]
      );

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("should use default concurrency of 5", async () => {
      const { enableWorkflow } = await import("./workflows.js");
      const mockEnableWorkflow = vi.mocked(enableWorkflow);

      // Track concurrent calls
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockEnableWorkflow.mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return { success: true, message: "Enabled" };
      });

      await batchEnableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10"]
      );

      // Should not exceed default concurrency of 5
      expect(maxConcurrent).toBeLessThanOrEqual(5);
    });
  });

  describe("batchDisableWorkflows", () => {
    it("should disable multiple workflows successfully", async () => {
      const { disableWorkflow } = await import("./workflows.js");
      const mockDisableWorkflow = vi.mocked(disableWorkflow);
      mockDisableWorkflow.mockResolvedValue({ success: true, message: "Disabled" });

      const result = await batchDisableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["workflow1", "workflow2", "workflow3"]
      );

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockDisableWorkflow).toHaveBeenCalledTimes(3);
    });

    it("should handle all failures", async () => {
      const { disableWorkflow } = await import("./workflows.js");
      const mockDisableWorkflow = vi.mocked(disableWorkflow);
      mockDisableWorkflow.mockRejectedValue(new Error("Service unavailable"));

      const result = await batchDisableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["workflow1", "workflow2"]
      );

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.results.every((r) => !r.success)).toBe(true);
      expect(result.results.every((r) => r.error?.includes("Service unavailable"))).toBe(true);
    });

    it("should respect custom concurrency", async () => {
      const { disableWorkflow } = await import("./workflows.js");
      const mockDisableWorkflow = vi.mocked(disableWorkflow);

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockDisableWorkflow.mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return { success: true, message: "Disabled" };
      });

      await batchDisableWorkflows(
        "sub-123",
        "rg",
        "myapp",
        ["w1", "w2", "w3", "w4", "w5", "w6"],
        2 // Custom concurrency of 2
      );

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});
