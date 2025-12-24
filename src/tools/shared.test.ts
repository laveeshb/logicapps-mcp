import { describe, it, expect } from "vitest";
import { extractResourceGroup } from "./shared.js";

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
});
