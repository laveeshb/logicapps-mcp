import { describe, it, expect, vi, beforeEach } from "vitest";
import { createConnection, redactSensitiveParameters } from "./connections.js";
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

  describe("redactSensitiveParameters", () => {
    it("should return undefined for undefined input", () => {
      expect(redactSensitiveParameters(undefined)).toBeUndefined();
    });

    it("should return empty object for empty input", () => {
      expect(redactSensitiveParameters({})).toEqual({});
    });

    it("should redact password fields", () => {
      const input = { password: "secret123", username: "admin" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({ password: "***REDACTED***", username: "admin" });
    });

    it("should redact apiKey fields", () => {
      const input = { apiKey: "key-123", endpoint: "https://api.example.com" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({ apiKey: "***REDACTED***", endpoint: "https://api.example.com" });
    });

    it("should redact accessKey fields (case insensitive)", () => {
      const input = { accessKey: "abc123", primaryAccessKey: "def456", name: "test" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        accessKey: "***REDACTED***",
        primaryAccessKey: "***REDACTED***",
        name: "test",
      });
    });

    it("should redact secret fields", () => {
      const input = { clientSecret: "secret", clientId: "id123" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({ clientSecret: "***REDACTED***", clientId: "id123" });
    });

    it("should redact token fields", () => {
      const input = { accessToken: "token123", refreshToken: "refresh456", scope: "read" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        accessToken: "***REDACTED***",
        refreshToken: "***REDACTED***",
        scope: "read",
      });
    });

    it("should redact connectionString fields", () => {
      const input = {
        connectionString: "Server=localhost;Database=test;Password=secret",
        databaseName: "test",
      };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        connectionString: "***REDACTED***",
        databaseName: "test",
      });
    });

    it("should redact credential fields", () => {
      const input = { credential: "cred123", userCredential: "user-cred" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        credential: "***REDACTED***",
        userCredential: "***REDACTED***",
      });
    });

    it("should redact auth and authorization fields", () => {
      const input = { auth: "Bearer xyz", authorization: "Basic abc", authMethod: "oauth" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        auth: "***REDACTED***",
        authorization: "***REDACTED***",
        authMethod: "oauth", // authMethod doesn't match patterns
      });
    });

    it("should redact certificate and passphrase fields", () => {
      const input = { certificate: "cert-data", passphrase: "phrase123", name: "cert1" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        certificate: "***REDACTED***",
        passphrase: "***REDACTED***",
        name: "cert1",
      });
    });

    it("should redact privateKey but not publicKey", () => {
      const input = { privateKey: "key-data", publicKey: "pub-data" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        privateKey: "***REDACTED***",
        publicKey: "pub-data", // publicKey is not sensitive
      });
    });

    it("should handle nested objects recursively", () => {
      const input = {
        connection: {
          password: "secret123",
          host: "localhost",
          settings: {
            apiKey: "key-456",
            username: "admin",
          },
        },
        name: "my-connection",
      };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        connection: {
          password: "***REDACTED***",
          host: "localhost",
          settings: {
            apiKey: "***REDACTED***",
            username: "admin",
          },
        },
        name: "my-connection",
      });
    });

    it("should preserve arrays without modification", () => {
      const input = { scopes: ["read", "write"], apiKey: "secret" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        scopes: ["read", "write"],
        apiKey: "***REDACTED***",
      });
    });

    it("should preserve null values for non-sensitive fields", () => {
      const input = { endpoint: null, username: "admin" };
      const result = redactSensitiveParameters(input as Record<string, unknown>);
      expect(result).toEqual({ endpoint: null, username: "admin" });
    });

    it("should redact sensitive fields even when value is null", () => {
      const input = { password: null, username: "admin" };
      const result = redactSensitiveParameters(input as Record<string, unknown>);
      expect(result).toEqual({ password: "***REDACTED***", username: "admin" });
    });

    it("should be case insensitive for pattern matching", () => {
      const input = { PASSWORD: "secret", ApiKey: "key", AccessToken: "tok" };
      const result = redactSensitiveParameters(input);
      expect(result).toEqual({
        PASSWORD: "***REDACTED***",
        ApiKey: "***REDACTED***",
        AccessToken: "***REDACTED***",
      });
    });
  });
});
