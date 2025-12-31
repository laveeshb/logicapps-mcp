import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTriggerHistory } from "./triggers.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
  armRequestVoid: vi.fn(),
  armRequestAllPages: vi.fn(),
  workflowMgmtRequest: vi.fn(),
}));

// Mock the shared module
vi.mock("./shared.js", () => ({
  detectLogicAppSku: vi.fn(),
  getStandardAppAccess: vi.fn(),
}));

describe("triggers", () => {
  describe("getTriggerHistory", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should respect top parameter for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });

      // Return more results than requested
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        value: [
          { name: "hist1", properties: { status: "Succeeded", startTime: "2024-01-01", fired: true } },
          { name: "hist2", properties: { status: "Succeeded", startTime: "2024-01-02", fired: true } },
          { name: "hist3", properties: { status: "Failed", startTime: "2024-01-03", fired: true } },
          { name: "hist4", properties: { status: "Succeeded", startTime: "2024-01-04", fired: true } },
          { name: "hist5", properties: { status: "Skipped", startTime: "2024-01-05", fired: false } },
        ],
      });

      // Request only 3 results
      const result = await getTriggerHistory(
        "sub-123",
        "rg",
        "myapp",
        "manual",
        "workflow1",
        3
      );

      // Should only return 3 results even though API returned 5
      expect(result.histories).toHaveLength(3);
      expect(result.histories[0].name).toBe("hist1");
      expect(result.histories[1].name).toBe("hist2");
      expect(result.histories[2].name).toBe("hist3");
    });

    it("should respect top parameter for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequestAllPages } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");

      // Return more results than requested
      vi.mocked(armRequestAllPages).mockResolvedValue([
        { name: "hist1", properties: { status: "Succeeded", startTime: "2024-01-01", fired: true } },
        { name: "hist2", properties: { status: "Succeeded", startTime: "2024-01-02", fired: true } },
        { name: "hist3", properties: { status: "Failed", startTime: "2024-01-03", fired: true } },
        { name: "hist4", properties: { status: "Succeeded", startTime: "2024-01-04", fired: true } },
        { name: "hist5", properties: { status: "Skipped", startTime: "2024-01-05", fired: false } },
      ]);

      // Request only 2 results
      const result = await getTriggerHistory("sub-123", "rg", "myapp", "manual", undefined, 2);

      // Should only return 2 results even though API returned 5
      expect(result.histories).toHaveLength(2);
      expect(result.histories[0].name).toBe("hist1");
      expect(result.histories[1].name).toBe("hist2");
    });

    it("should use default top of 25 when not specified", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({ value: [] });

      await getTriggerHistory("sub-123", "rg", "myapp", "manual", "workflow1");

      // Check that $top=25 is in the URL
      expect(workflowMgmtRequest).toHaveBeenCalledWith(
        "myapp.azurewebsites.net",
        expect.stringContaining("$top=25"),
        "test-key"
      );
    });

    it("should cap top at 100", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({ value: [] });

      // Request 500 results
      await getTriggerHistory("sub-123", "rg", "myapp", "manual", "workflow1", 500);

      // Check that $top=100 is in the URL (capped)
      expect(workflowMgmtRequest).toHaveBeenCalledWith(
        "myapp.azurewebsites.net",
        expect.stringContaining("$top=100"),
        "test-key"
      );
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(
        getTriggerHistory("sub-123", "rg", "myapp", "manual", undefined, 10)
      ).rejects.toThrow("workflowName is required for Standard Logic Apps");
    });
  });
});
