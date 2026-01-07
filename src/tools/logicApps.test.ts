import { describe, it, expect, vi, beforeEach } from "vitest";
import { listLogicApps } from "./logicApps.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
}));

// Mock the shared module
vi.mock("./shared.js", () => ({
  extractResourceGroup: vi.fn().mockImplementation((id: string) => {
    const match = id.match(/resourceGroups\/([^/]+)/i);
    return match ? match[1] : "";
  }),
}));

describe("logicApps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listLogicApps", () => {
    it("should list both Consumption and Standard Logic Apps by default", async () => {
      const { armRequest } = await import("../utils/http.js");

      // First call for Consumption
      vi.mocked(armRequest)
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Logic/workflows/consumption-app",
              name: "consumption-app",
              location: "eastus",
              properties: {
                state: "Enabled",
                createdTime: "2024-01-01T00:00:00Z",
                changedTime: "2024-01-02T00:00:00Z",
              },
              tags: { env: "prod" },
            },
          ],
        })
        // Second call for Standard
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/rg2/providers/Microsoft.Web/sites/standard-app",
              name: "standard-app",
              location: "westus2",
              kind: "functionapp,workflowapp",
              properties: {
                state: "Running",
              },
              tags: { env: "dev" },
            },
          ],
        });

      const result = await listLogicApps("sub-123");

      expect(result.logicApps).toHaveLength(2);
      expect(result.logicApps[0].name).toBe("consumption-app");
      expect(result.logicApps[0].sku).toBe("consumption");
      expect(result.logicApps[0].location).toBe("eastus");
      expect(result.logicApps[1].name).toBe("standard-app");
      expect(result.logicApps[1].sku).toBe("standard");
      expect(result.logicApps[1].location).toBe("westus2");
    });

    it("should filter by Consumption SKU only", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest).mockResolvedValueOnce({
        value: [
          {
            id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Logic/workflows/app1",
            name: "app1",
            location: "eastus",
            properties: { state: "Enabled" },
          },
          {
            id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Logic/workflows/app2",
            name: "app2",
            location: "eastus",
            properties: { state: "Disabled" },
          },
        ],
      });

      const result = await listLogicApps("sub-123", undefined, "consumption");

      expect(result.logicApps).toHaveLength(2);
      expect(result.logicApps.every((app) => app.sku === "consumption")).toBe(true);
      // armRequest should only be called once (for Consumption)
      expect(armRequest).toHaveBeenCalledTimes(1);
    });

    it("should filter by Standard SKU only", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest).mockResolvedValueOnce({
        value: [
          {
            id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Web/sites/app1",
            name: "app1",
            location: "westus2",
            kind: "functionapp,workflowapp",
            properties: { state: "Running" },
          },
        ],
      });

      const result = await listLogicApps("sub-123", undefined, "standard");

      expect(result.logicApps).toHaveLength(1);
      expect(result.logicApps[0].sku).toBe("standard");
      // armRequest should only be called once (for Standard)
      expect(armRequest).toHaveBeenCalledTimes(1);
    });

    it("should filter by resource group", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/my-rg/providers/Microsoft.Logic/workflows/app1",
              name: "app1",
              location: "eastus",
              properties: { state: "Enabled" },
            },
          ],
        })
        .mockResolvedValueOnce({ value: [] });

      const result = await listLogicApps("sub-123", "my-rg");

      // Verify path includes resource group
      expect(armRequest).toHaveBeenCalledWith(
        expect.stringContaining("resourceGroups/my-rg"),
        expect.any(Object)
      );
      expect(result.logicApps).toHaveLength(1);
    });

    it("should filter Standard sites to only include workflowapp kind", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({ value: [] }) // No Consumption apps
        .mockResolvedValueOnce({
          // Standard sites - mix of workflow apps and other apps
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Web/sites/workflow-app",
              name: "workflow-app",
              location: "eastus",
              kind: "functionapp,workflowapp",
              properties: { state: "Running" },
            },
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Web/sites/function-app",
              name: "function-app",
              location: "eastus",
              kind: "functionapp",
              properties: { state: "Running" },
            },
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Web/sites/web-app",
              name: "web-app",
              location: "eastus",
              kind: "app",
              properties: { state: "Running" },
            },
          ],
        });

      const result = await listLogicApps("sub-123");

      // Should only include the workflowapp
      expect(result.logicApps).toHaveLength(1);
      expect(result.logicApps[0].name).toBe("workflow-app");
    });

    it("should handle empty results", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({ value: [] });

      const result = await listLogicApps("sub-123");

      expect(result.logicApps).toHaveLength(0);
    });

    it("should include tags in response", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Logic/workflows/app1",
              name: "app1",
              location: "eastus",
              properties: { state: "Enabled" },
              tags: { environment: "production", team: "platform" },
            },
          ],
        })
        .mockResolvedValueOnce({ value: [] });

      const result = await listLogicApps("sub-123");

      expect(result.logicApps[0].tags).toEqual({
        environment: "production",
        team: "platform",
      });
    });

    it("should extract resource group from ID", async () => {
      const { armRequest } = await import("../utils/http.js");
      const { extractResourceGroup } = await import("./shared.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/my-resource-group/providers/Microsoft.Logic/workflows/app1",
              name: "app1",
              location: "eastus",
              properties: { state: "Enabled" },
            },
          ],
        })
        .mockResolvedValueOnce({ value: [] });

      const result = await listLogicApps("sub-123");

      expect(extractResourceGroup).toHaveBeenCalled();
      expect(result.logicApps[0].resourceGroup).toBe("my-resource-group");
    });

    it("should return nextLink for pagination", async () => {
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(armRequest)
        .mockResolvedValueOnce({
          value: [
            {
              id: "/subscriptions/sub-123/resourceGroups/rg1/providers/Microsoft.Logic/workflows/app1",
              name: "app1",
              location: "eastus",
              properties: { state: "Enabled" },
            },
          ],
          nextLink: "https://management.azure.com/nextpage?skiptoken=abc123",
        })
        .mockResolvedValueOnce({
          value: [],
          nextLink: "https://management.azure.com/nextpage?skiptoken=def456",
        });

      const result = await listLogicApps("sub-123");

      expect(result.consumptionNextLink).toBe("https://management.azure.com/nextpage?skiptoken=abc123");
      expect(result.standardNextLink).toBe("https://management.azure.com/nextpage?skiptoken=def456");
    });
  });
});
