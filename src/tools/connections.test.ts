import { describe, it, expect, vi, beforeEach } from "vitest";
import { createConnection } from "./connections.js";
import { McpError } from "../utils/errors.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
  armRequestAllPages: vi.fn(),
}));

// Mock the token manager
vi.mock("../auth/tokenManager.js", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock the clouds config
vi.mock("../config/clouds.js", () => ({
  getCloudEndpoints: vi.fn().mockReturnValue({
    resourceManager: "https://management.azure.com",
  }),
}));

describe("connections", () => {
  describe("createConnection validation", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw error when subscriptionId is empty", async () => {
      await expect(
        createConnection("", "rg", "conn", "azureblob", "westus2")
      ).rejects.toThrow(McpError);

      await expect(
        createConnection("", "rg", "conn", "azureblob", "westus2")
      ).rejects.toThrow("subscriptionId is required and cannot be empty");
    });

    it("should throw error when subscriptionId is whitespace", async () => {
      await expect(
        createConnection("   ", "rg", "conn", "azureblob", "westus2")
      ).rejects.toThrow("subscriptionId is required and cannot be empty");
    });

    it("should throw error when resourceGroupName is empty", async () => {
      await expect(
        createConnection("sub-123", "", "conn", "azureblob", "westus2")
      ).rejects.toThrow("resourceGroupName is required and cannot be empty");
    });

    it("should throw error when connectionName is empty", async () => {
      await expect(
        createConnection("sub-123", "rg", "", "azureblob", "westus2")
      ).rejects.toThrow("connectionName is required and cannot be empty");
    });

    it("should throw error when connectorName is empty", async () => {
      await expect(
        createConnection("sub-123", "rg", "conn", "", "westus2")
      ).rejects.toThrow("connectorName is required and cannot be empty");
    });

    it("should throw error when location is empty", async () => {
      await expect(
        createConnection("sub-123", "rg", "conn", "azureblob", "")
      ).rejects.toThrow("location is required and cannot be empty");
    });

    it("should throw error when connectionName starts with hyphen", async () => {
      await expect(
        createConnection("sub-123", "rg", "-invalid", "azureblob", "westus2")
      ).rejects.toThrow(
        "connectionName must start with a letter or number and can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("should throw error when connectionName starts with underscore", async () => {
      await expect(
        createConnection("sub-123", "rg", "_invalid", "azureblob", "westus2")
      ).rejects.toThrow(
        "connectionName must start with a letter or number and can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("should throw error when connectionName contains invalid characters", async () => {
      await expect(
        createConnection("sub-123", "rg", "conn@name", "azureblob", "westus2")
      ).rejects.toThrow(
        "connectionName must start with a letter or number and can only contain letters, numbers, hyphens, and underscores"
      );

      await expect(
        createConnection("sub-123", "rg", "conn.name", "azureblob", "westus2")
      ).rejects.toThrow(
        "connectionName must start with a letter or number and can only contain letters, numbers, hyphens, and underscores"
      );

      await expect(
        createConnection("sub-123", "rg", "conn name", "azureblob", "westus2")
      ).rejects.toThrow(
        "connectionName must start with a letter or number and can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("should throw error when connectionName exceeds 80 characters", async () => {
      const longName = "a".repeat(81);
      await expect(
        createConnection("sub-123", "rg", longName, "azureblob", "westus2")
      ).rejects.toThrow("connectionName must be 80 characters or less");
    });

    it("should accept valid connectionName with letters only", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);
      mockArmRequest.mockResolvedValueOnce({
        id: "/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/validname",
        name: "validname",
        location: "westus2",
        properties: {
          displayName: "validname",
          statuses: [{ status: "Connected" }],
        },
      });

      const result = await createConnection("sub-123", "rg", "validname", "azureblob", "westus2");
      expect(result.connectionName).toBe("validname");
    });

    it("should accept valid connectionName with numbers", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);
      mockArmRequest.mockResolvedValueOnce({
        id: "/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/conn123",
        name: "conn123",
        location: "westus2",
        properties: {
          displayName: "conn123",
          statuses: [{ status: "Connected" }],
        },
      });

      const result = await createConnection("sub-123", "rg", "conn123", "azureblob", "westus2");
      expect(result.connectionName).toBe("conn123");
    });

    it("should accept valid connectionName starting with number", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);
      mockArmRequest.mockResolvedValueOnce({
        id: "/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/123conn",
        name: "123conn",
        location: "westus2",
        properties: {
          displayName: "123conn",
          statuses: [{ status: "Connected" }],
        },
      });

      const result = await createConnection("sub-123", "rg", "123conn", "azureblob", "westus2");
      expect(result.connectionName).toBe("123conn");
    });

    it("should accept valid connectionName with hyphens and underscores", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);
      mockArmRequest.mockResolvedValueOnce({
        id: "/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/my-conn_1",
        name: "my-conn_1",
        location: "westus2",
        properties: {
          displayName: "my-conn_1",
          statuses: [{ status: "Connected" }],
        },
      });

      const result = await createConnection("sub-123", "rg", "my-conn_1", "azureblob", "westus2");
      expect(result.connectionName).toBe("my-conn_1");
    });

    it("should accept connectionName at exactly 80 characters", async () => {
      const { armRequest } = await import("../utils/http.js");
      const mockArmRequest = vi.mocked(armRequest);
      const exactName = "a".repeat(80);
      mockArmRequest.mockResolvedValueOnce({
        id: `/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/${exactName}`,
        name: exactName,
        location: "westus2",
        properties: {
          displayName: exactName,
          statuses: [{ status: "Connected" }],
        },
      });

      const result = await createConnection("sub-123", "rg", exactName, "azureblob", "westus2");
      expect(result.connectionName).toBe(exactName);
    });
  });
});
