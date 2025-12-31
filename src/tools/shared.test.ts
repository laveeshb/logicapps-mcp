import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractResourceGroup,
  detectLogicAppSku,
  getStandardAppAccess,
  clearCache,
  setCacheTtl,
} from "./shared.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
}));

describe("shared", () => {
  describe("extractResourceGroup", () => {
    it("should extract resource group from standard ARM ID", () => {
      const id =
        "/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/my-rg/providers/Microsoft.Logic/workflows/my-workflow";

      expect(extractResourceGroup(id)).toBe("my-rg");
    });

    it("should handle case-insensitive resourceGroups", () => {
      const id =
        "/subscriptions/12345678-1234-1234-1234-123456789012/RESOURCEGROUPS/MyResourceGroup/providers/Microsoft.Web/sites/my-site";

      expect(extractResourceGroup(id)).toBe("MyResourceGroup");
    });

    it("should return empty string for invalid resource ID", () => {
      expect(extractResourceGroup("/subscriptions/123")).toBe("");
      expect(extractResourceGroup("")).toBe("");
      expect(extractResourceGroup("invalid")).toBe("");
    });

    it("should handle resource groups with special characters", () => {
      const id =
        "/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/my-rg_123/providers/Microsoft.Logic/workflows/wf";

      expect(extractResourceGroup(id)).toBe("my-rg_123");
    });

    it("should handle nested resource IDs", () => {
      const id =
        "/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/prod-rg/providers/Microsoft.Logic/workflows/my-workflow/runs/08585123";

      expect(extractResourceGroup(id)).toBe("prod-rg");
    });
  });

  describe("detectLogicAppSku caching", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      clearCache();
      setCacheTtl(300); // Reset to default
    });

    it("should cache SKU detection results", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);

      // First call returns consumption workflow
      mockArmRequest.mockResolvedValueOnce({ name: "test-workflow" });

      const result1 = await detectLogicAppSku("sub-123", "rg", "myapp");
      expect(result1).toBe("consumption");
      expect(mockArmRequest).toHaveBeenCalledTimes(1);

      // Second call should use cache (no additional API call)
      const result2 = await detectLogicAppSku("sub-123", "rg", "myapp");
      expect(result2).toBe("consumption");
      expect(mockArmRequest).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should use case-insensitive cache keys", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);

      mockArmRequest.mockResolvedValueOnce({ name: "test-workflow" });

      await detectLogicAppSku("SUB-123", "RG", "MYAPP");
      expect(mockArmRequest).toHaveBeenCalledTimes(1);

      // Same resource with different case should hit cache
      const result = await detectLogicAppSku("sub-123", "rg", "myapp");
      expect(result).toBe("consumption");
      expect(mockArmRequest).toHaveBeenCalledTimes(1);
    });

    it("should clear cache when requested", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);

      mockArmRequest.mockResolvedValue({ name: "test-workflow" });

      await detectLogicAppSku("sub-123", "rg", "myapp");
      expect(mockArmRequest).toHaveBeenCalledTimes(1);

      // Clear cache
      clearCache();

      // Should make a new API call
      await detectLogicAppSku("sub-123", "rg", "myapp");
      expect(mockArmRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("getStandardAppAccess caching", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      clearCache();
      setCacheTtl(300);
    });

    it("should cache Standard app access details", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);

      // Mock responses for site and keys
      mockArmRequest
        .mockResolvedValueOnce({ properties: { defaultHostName: "myapp.azurewebsites.net" } })
        .mockResolvedValueOnce({ masterKey: "test-key-123" });

      const result1 = await getStandardAppAccess("sub-123", "rg", "myapp");
      expect(result1.hostname).toBe("myapp.azurewebsites.net");
      expect(result1.masterKey).toBe("test-key-123");
      expect(mockArmRequest).toHaveBeenCalledTimes(2);

      // Second call should use cache
      const result2 = await getStandardAppAccess("sub-123", "rg", "myapp");
      expect(result2.hostname).toBe("myapp.azurewebsites.net");
      expect(mockArmRequest).toHaveBeenCalledTimes(2); // Still 2
    });

    it("should clear specific cache entries", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);

      mockArmRequest
        .mockResolvedValueOnce({ properties: { defaultHostName: "app1.azurewebsites.net" } })
        .mockResolvedValueOnce({ masterKey: "key1" })
        .mockResolvedValueOnce({ properties: { defaultHostName: "app2.azurewebsites.net" } })
        .mockResolvedValueOnce({ masterKey: "key2" });

      await getStandardAppAccess("sub-123", "rg", "app1");
      await getStandardAppAccess("sub-123", "rg", "app2");
      expect(mockArmRequest).toHaveBeenCalledTimes(4);

      // Clear only app1 cache
      clearCache("sub-123", "rg", "app1");

      // app1 should make new calls, app2 should still be cached
      mockArmRequest
        .mockResolvedValueOnce({ properties: { defaultHostName: "app1.azurewebsites.net" } })
        .mockResolvedValueOnce({ masterKey: "key1-new" });

      await getStandardAppAccess("sub-123", "rg", "app1");
      expect(mockArmRequest).toHaveBeenCalledTimes(6); // 4 + 2 for app1

      await getStandardAppAccess("sub-123", "rg", "app2");
      expect(mockArmRequest).toHaveBeenCalledTimes(6); // Still 6, app2 cached
    });
  });
});
