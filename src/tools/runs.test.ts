import { describe, it, expect, vi, beforeEach } from "vitest";
import { listRunHistory, getRunDetails, getRunActions } from "./runs.js";

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
  getConsumptionRunPortalUrl: vi.fn().mockReturnValue("https://portal.azure.com/consumption-run"),
  getStandardRunPortalUrl: vi.fn().mockReturnValue("https://portal.azure.com/standard-run"),
}));

describe("runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listRunHistory", () => {
    it("should list runs for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest)
        .mockResolvedValueOnce({ location: "eastus" }) // Logic App fetch
        .mockResolvedValueOnce({
          value: [
            {
              id: "/runs/run1",
              name: "run1",
              properties: {
                status: "Succeeded",
                startTime: "2024-01-01T00:00:00Z",
                endTime: "2024-01-01T00:01:00Z",
                trigger: { name: "manual" },
                correlation: { clientTrackingId: "tracking-1" },
              },
            },
            {
              id: "/runs/run2",
              name: "run2",
              properties: {
                status: "Failed",
                startTime: "2024-01-02T00:00:00Z",
                trigger: { name: "recurrence" },
              },
            },
          ],
          nextLink: "https://nextpage",
        });

      const result = await listRunHistory("sub-123", "rg", "myapp");

      expect(result.runs).toHaveLength(2);
      expect(result.runs[0].name).toBe("run1");
      expect(result.runs[0].status).toBe("Succeeded");
      expect(result.runs[0].trigger.name).toBe("manual");
      expect(result.runs[0].correlation?.clientTrackingId).toBe("tracking-1");
      expect(result.runs[1].name).toBe("run2");
      expect(result.runs[1].status).toBe("Failed");
      expect(result.nextLink).toBe("https://nextpage");
    });

    it("should list runs for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        value: [
          {
            id: "/runs/run1",
            name: "run1",
            properties: {
              status: "Running",
              startTime: "2024-01-01T00:00:00Z",
              trigger: { name: "When_a_HTTP_request_is_received" },
            },
          },
        ],
      });

      const result = await listRunHistory("sub-123", "rg", "myapp", "workflow1");

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].name).toBe("run1");
      expect(result.runs[0].status).toBe("Running");
      expect(result.runs[0].trigger.name).toBe("When_a_HTTP_request_is_received");
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(listRunHistory("sub-123", "rg", "myapp")).rejects.toThrow(
        "workflowName is required for Standard Logic Apps"
      );
    });

    it("should respect top parameter", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({ value: [] });

      await listRunHistory("sub-123", "rg", "myapp", "workflow1", 50);

      expect(workflowMgmtRequest).toHaveBeenCalledWith(
        "myapp.azurewebsites.net",
        expect.stringContaining("$top=50"),
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

      await listRunHistory("sub-123", "rg", "myapp", "workflow1", 200);

      expect(workflowMgmtRequest).toHaveBeenCalledWith(
        "myapp.azurewebsites.net",
        expect.stringContaining("$top=100"),
        "test-key"
      );
    });

    it("should include filter and skipToken in request", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest)
        .mockResolvedValueOnce({ location: "eastus" })
        .mockResolvedValueOnce({ value: [] });

      await listRunHistory(
        "sub-123",
        "rg",
        "myapp",
        undefined,
        25,
        "status eq 'Failed'",
        "token123"
      );

      expect(armRequest).toHaveBeenLastCalledWith(
        expect.stringContaining("/runs"),
        expect.objectContaining({
          queryParams: expect.objectContaining({
            $filter: "status eq 'Failed'",
            $skiptoken: "token123",
          }),
        })
      );
    });

    it("should handle empty run list", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest)
        .mockResolvedValueOnce({ location: "eastus" })
        .mockResolvedValueOnce({ value: [] });

      const result = await listRunHistory("sub-123", "rg", "myapp");

      expect(result.runs).toHaveLength(0);
      expect(result.nextLink).toBeUndefined();
    });

    it("should handle missing trigger name", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest)
        .mockResolvedValueOnce({ location: "eastus" })
        .mockResolvedValueOnce({
          value: [
            {
              id: "/runs/run1",
              name: "run1",
              properties: {
                status: "Succeeded",
                startTime: "2024-01-01T00:00:00Z",
                // No trigger property
              },
            },
          ],
        });

      const result = await listRunHistory("sub-123", "rg", "myapp");

      expect(result.runs[0].trigger.name).toBe("unknown");
    });
  });

  describe("getRunDetails", () => {
    it("should get run details for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest)
        .mockResolvedValueOnce({ location: "eastus" }) // Logic App fetch
        .mockResolvedValueOnce({
          id: "/runs/run1",
          name: "run1",
          properties: {
            status: "Failed",
            startTime: "2024-01-01T00:00:00Z",
            endTime: "2024-01-01T00:01:00Z",
            trigger: { name: "manual" },
            error: { code: "ActionFailed", message: "HTTP action failed" },
          },
        });

      const result = await getRunDetails("sub-123", "rg", "myapp", "run1");

      expect(result.run.name).toBe("run1");
      expect(result.run.status).toBe("Failed");
      expect(result.run.error?.code).toBe("ActionFailed");
      expect(result.run.error?.message).toBe("HTTP action failed");
    });

    it("should get run details for Standard SKU", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        id: "/runs/run1",
        name: "run1",
        properties: {
          status: "Succeeded",
          startTime: "2024-01-01T00:00:00Z",
          endTime: "2024-01-01T00:05:00Z",
          trigger: { name: "Request" },
        },
      });

      const result = await getRunDetails("sub-123", "rg", "myapp", "run1", "workflow1");

      expect(result.run.name).toBe("run1");
      expect(result.run.status).toBe("Succeeded");
      expect(result.run.portalUrl).toBeDefined();
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(getRunDetails("sub-123", "rg", "myapp", "run1")).rejects.toThrow(
        "workflowName is required for Standard Logic Apps"
      );
    });
  });

  describe("getRunActions", () => {
    it("should get run actions for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        value: [
          {
            name: "HTTP",
            type: "Http",
            properties: {
              status: "Succeeded",
              startTime: "2024-01-01T00:00:00Z",
              endTime: "2024-01-01T00:00:01Z",
              trackedProperties: { key: "value" },
            },
          },
          {
            name: "Response",
            type: "Response",
            properties: {
              status: "Succeeded",
              startTime: "2024-01-01T00:00:01Z",
              endTime: "2024-01-01T00:00:02Z",
            },
          },
        ],
      });

      const result = await getRunActions("sub-123", "rg", "myapp", "run1");

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].name).toBe("HTTP");
      expect(result.actions[0].type).toBe("Http");
      expect(result.actions[0].status).toBe("Succeeded");
      expect(result.actions[0].trackedProperties).toEqual({ key: "value" });
    });

    it("should get specific action for Consumption SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({
        name: "HTTP",
        properties: {
          type: "Http",
          status: "Failed",
          startTime: "2024-01-01T00:00:00Z",
          error: { code: "BadRequest", message: "Invalid URL" },
        },
      });

      const result = await getRunActions("sub-123", "rg", "myapp", "run1", undefined, "HTTP");

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe("HTTP");
      expect(result.actions[0].error?.code).toBe("BadRequest");
    });

    it("should get run actions for Standard SKU with pagination", async () => {
      const { detectLogicAppSku, getStandardAppAccess } = await import("./shared.js");
      const { workflowMgmtRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");
      vi.mocked(getStandardAppAccess).mockResolvedValue({
        hostname: "myapp.azurewebsites.net",
        masterKey: "test-key",
      });
      vi.mocked(workflowMgmtRequest).mockResolvedValue({
        value: [
          {
            name: "Compose",
            type: "Compose",
            properties: {
              status: "Succeeded",
              startTime: "2024-01-01T00:00:00Z",
            },
          },
        ],
      });

      const result = await getRunActions("sub-123", "rg", "myapp", "run1", "workflow1");

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe("Compose");
    });

    it("should throw error when workflowName missing for Standard SKU", async () => {
      const { detectLogicAppSku } = await import("./shared.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("standard");

      await expect(getRunActions("sub-123", "rg", "myapp", "run1")).rejects.toThrow(
        "workflowName is required for Standard Logic Apps"
      );
    });

    it("should handle empty actions list", async () => {
      const { detectLogicAppSku } = await import("./shared.js");
      const { armRequest } = await import("../utils/http.js");

      vi.mocked(detectLogicAppSku).mockResolvedValue("consumption");
      vi.mocked(armRequest).mockResolvedValue({ value: [] });

      const result = await getRunActions("sub-123", "rg", "myapp", "run1");

      expect(result.actions).toHaveLength(0);
    });
  });
});
