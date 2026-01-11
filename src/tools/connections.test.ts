import { describe, it, expect, vi, beforeEach } from "vitest";
import { createConnection } from "./connections.js";

// Mock the http module
vi.mock("../utils/http.js", () => ({
  armRequest: vi.fn(),
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

    // Parameterized tests for empty/whitespace validation
    const emptyFieldCases = [
      { field: "subscriptionId", args: ["", "rg", "conn", "azureblob", "westus2"] as const, error: "subscriptionId is required" },
      { field: "subscriptionId (whitespace)", args: ["   ", "rg", "conn", "azureblob", "westus2"] as const, error: "subscriptionId is required" },
      { field: "resourceGroupName", args: ["sub-123", "", "conn", "azureblob", "westus2"] as const, error: "resourceGroupName is required" },
      { field: "connectionName", args: ["sub-123", "rg", "", "azureblob", "westus2"] as const, error: "connectionName is required" },
      { field: "connectorName", args: ["sub-123", "rg", "conn", "", "westus2"] as const, error: "connectorName is required" },
      { field: "location", args: ["sub-123", "rg", "conn", "azureblob", ""] as const, error: "location is required" },
    ];

    it.each(emptyFieldCases)("should throw error when $field is empty", async ({ args, error }) => {
      await expect(createConnection(args[0], args[1], args[2], args[3], args[4])).rejects.toThrow(error);
    });

    // Parameterized tests for invalid connectionName formats
    const invalidNameCases = [
      { name: "-invalid", desc: "starts with hyphen" },
      { name: "_invalid", desc: "starts with underscore" },
      { name: "conn@name", desc: "contains @" },
      { name: "conn.name", desc: "contains ." },
      { name: "conn name", desc: "contains space" },
    ];

    it.each(invalidNameCases)("should throw error when connectionName $desc", async ({ name }) => {
      await expect(
        createConnection("sub-123", "rg", name, "azureblob", "westus2")
      ).rejects.toThrow("connectionName must start with a letter or number");
    });

    it("should throw error when connectionName exceeds 80 characters", async () => {
      await expect(
        createConnection("sub-123", "rg", "a".repeat(81), "azureblob", "westus2")
      ).rejects.toThrow("connectionName must be 80 characters or less");
    });

    // Parameterized tests for valid connectionName formats
    const validNameCases = [
      { name: "validname", desc: "letters only" },
      { name: "conn123", desc: "with numbers" },
      { name: "123conn", desc: "starting with number" },
      { name: "my-conn_1", desc: "with hyphens and underscores" },
      { name: "a".repeat(80), desc: "at exactly 80 characters" },
    ];

    it.each(validNameCases)("should accept valid connectionName $desc", async ({ name }) => {
      const { armRequest } = await import("../utils/http.js");
      vi.mocked(armRequest).mockResolvedValueOnce({
        id: `/subscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Web/connections/${name}`,
        name,
        location: "westus2",
        properties: { displayName: name, statuses: [{ status: "Connected" }] },
      });

      const result = await createConnection("sub-123", "rg", name, "azureblob", "westus2");
      expect(result.connectionName).toBe(name);
    });
  });
});
