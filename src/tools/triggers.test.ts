import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTriggerHistory } from "./triggers.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
  armRequestVoid: vi.fn(),
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

      // Return results with nextLink for pagination
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        value: [
          { name: "hist1", properties: { status: "Succeeded", startTime: "2024-01-01", fired: true } },
          { name: "hist2", properties: { status: "Succeeded", startTime: "2024-01-02", fired: true } },
          { name: "hist3", properties: { status: "Failed", startTime: "2024-01-03", fired: true } },
        ],
        nextLink: "https://next-page-url",
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

      // Returns all items from page - single page fetch
      expect(result.histories).toHaveLength(3);
      expect(result.histories[0].name).toBe("hist1");
      expect(result.histories[1].name).toBe("hist2");
      expect(result.histories[2].name).toBe("hist3");
      // nextLink returned for caller-controlled pagination
      expect(result.nextLink).toBe("https://next-page-url");
    });

    it("should respect top parameter for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");

      // armRequest now returns { value: [...] } format
      vi.mocked(armRequest).mockResolvedValue({
        value: [
          { name: "hist1", properties: { status: "Succeeded", startTime: "2024-01-01", fired: true } },
          { name: "hist2", properties: { status: "Succeeded", startTime: "2024-01-02", fired: true } },
        ],
      });

      // Request only 2 results
      const result = await getTriggerHistory("sub-123", "rg", "myapp", "manual", undefined, 2);

      // Should return the 2 results from API (API respects $top)
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
