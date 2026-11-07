/**
 * Tests for Azure CLI authentication module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

// Import after mocking
const { getAzureCliToken, checkAzureCliAuth } = await import("./azureCli.js");

describe("azureCli", () => {
  const mockExec = vi.mocked(exec);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getAzureCliToken", () => {
    it("should pass a timeout to the az call", async () => {
      let receivedOptions: unknown;
      mockExec.mockImplementation((_cmd: unknown, options?: unknown, callback?: unknown) => {
        receivedOptions = options;
        if (typeof callback === "function") {
          callback(null, {
            stdout: JSON.stringify({
              accessToken: "t",
              expiresOn: "2024-12-20T12:00:00Z",
              subscription: "s",
              tenant: "t",
              tokenType: "Bearer",
            }),
            stderr: "",
          });
        }
        return {} as ReturnType<typeof exec>;
      });

      await getAzureCliToken();

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(receivedOptions).toEqual({ timeout: 30000 });
    });

    it("should return token when Azure CLI returns valid response", async () => {
      const mockResponse = {
        accessToken: "mock-access-token",
        expiresOn: "2024-12-20T12:00:00Z",
        subscription: "sub-123",
        tenant: "tenant-456",
        tokenType: "Bearer",
      };

      mockExec.mockImplementation(
        (_cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          if (typeof callback === "function") {
            callback(null, { stdout: JSON.stringify(mockResponse), stderr: "" });
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      const token = await getAzureCliToken();

      expect(token.accessToken).toBe("mock-access-token");
      expect(token.subscription).toBe("sub-123");
      expect(token.tenant).toBe("tenant-456");
      expect(token.tokenType).toBe("Bearer");
      expect(token.expiresOn).toBeInstanceOf(Date);
    });

    it("should throw when Azure CLI is not installed", async () => {
      const error = new Error("ENOENT: command not found");
      mockExec.mockImplementation(
        (_cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          if (typeof callback === "function") {
            callback(error, "", "");
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      await expect(getAzureCliToken()).rejects.toThrow("Azure CLI is not installed");
    });

    it("should throw when user is not logged in", async () => {
      const error = new Error("Please run 'az login' to setup account");
      mockExec.mockImplementation(
        (_cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          if (typeof callback === "function") {
            callback(error, "", "");
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      await expect(getAzureCliToken()).rejects.toThrow("Not logged in to Azure CLI");
    });

    it("should use custom resource when provided", async () => {
      const mockResponse = {
        accessToken: "mock-token",
        expiresOn: "2024-12-20T12:00:00Z",
        subscription: "sub-123",
        tenant: "tenant-456",
        tokenType: "Bearer",
      };

      let capturedCommand = "";
      mockExec.mockImplementation(
        (cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          capturedCommand = cmd as string;
          if (typeof callback === "function") {
            callback(null, { stdout: JSON.stringify(mockResponse), stderr: "" });
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      await getAzureCliToken("https://vault.azure.net");

      expect(capturedCommand).toContain("--resource");
      expect(capturedCommand).toContain("https://vault.azure.net");
    });
  });

  describe("checkAzureCliAuth", () => {
    it("should return loggedIn true when authenticated", async () => {
      const mockResponse = {
        accessToken: "mock-token",
        expiresOn: "2024-12-20T12:00:00Z",
        subscription: "sub-123",
        tenant: "tenant-456",
        tokenType: "Bearer",
      };

      mockExec.mockImplementation(
        (_cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          if (typeof callback === "function") {
            callback(null, { stdout: JSON.stringify(mockResponse), stderr: "" });
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      const result = await checkAzureCliAuth();

      expect(result.loggedIn).toBe(true);
      expect(result.subscription).toBe("sub-123");
      expect(result.tenant).toBe("tenant-456");
      expect(result.error).toBeUndefined();
    });

    it("should return loggedIn false when not authenticated", async () => {
      const error = new Error("Please run 'az login'");
      mockExec.mockImplementation(
        (_cmd: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown) => {
          const callback =
            typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
          if (typeof callback === "function") {
            callback(error, "", "");
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      const result = await checkAzureCliAuth();

      expect(result.loggedIn).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
