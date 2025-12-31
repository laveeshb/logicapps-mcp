import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vfsRequest, setRetryConfig } from "./http.js";
import { McpError } from "./errors.js";

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

describe("http", () => {
  describe("vfsRequest", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.clearAllMocks();
      // Disable retries for unit tests to avoid timeouts
      setRetryConfig({ maxRetries: 0, timeoutMs: 5000 });
    });

    afterEach(() => {
      global.fetch = originalFetch;
      // Reset to defaults
      setRetryConfig({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, timeoutMs: 30000 });
    });

    it("should throw ConflictError on 412 Precondition Failed", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 412,
        statusText: "Precondition Failed",
        text: vi.fn().mockResolvedValue("ETag mismatch"),
      });

      await expect(
        vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "PUT",
          body: { definition: {} },
        })
      ).rejects.toThrow(McpError);

      await expect(
        vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "PUT",
          body: { definition: {} },
        })
      ).rejects.toThrow("Resource was modified by another process");
    });

    it("should return ConflictError code on 412", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 412,
        statusText: "Precondition Failed",
        text: vi.fn().mockResolvedValue(""),
      });

      try {
        await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "PUT",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe("ConflictError");
      }
    });

    it("should throw ConflictError on 409 Conflict", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        text: vi.fn().mockResolvedValue("Resource already exists"),
      });

      await expect(
        vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "PUT",
        })
      ).rejects.toThrow(McpError);

      try {
        await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "PUT",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe("ConflictError");
        expect((error as McpError).message).toContain("Resource already exists");
      }
    });

    it("should throw ServiceError on other error status codes", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue("Server error details"),
      });

      try {
        await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "GET",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe("ServiceError");
        expect((error as McpError).message).toContain("500");
      }
    });

    it("should succeed on 200 OK", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await expect(
        vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "GET",
        })
      ).resolves.toBeUndefined();
    });

    it("should include If-Match header for PUT requests", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
        method: "PUT",
        body: { test: true },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://myapp.azurewebsites.net/api/vfs/workflow.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-Match": "*",
          }),
        })
      );
    });

    it("should include If-Match header for DELETE requests", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
        method: "DELETE",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://myapp.azurewebsites.net/api/vfs/workflow.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-Match": "*",
          }),
        })
      );
    });
  });

  describe("retry behavior", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      setRetryConfig({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, timeoutMs: 30000 });
    });

    it("should retry on 500 errors", async () => {
      setRetryConfig({ maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100, timeoutMs: 5000 });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: () => Promise.resolve(""),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
        });
      });

      await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
        method: "GET",
      });

      expect(callCount).toBe(3); // Initial + 2 retries
    });

    it("should retry on 429 rate limit", async () => {
      setRetryConfig({ maxRetries: 1, baseDelayMs: 10, maxDelayMs: 100, timeoutMs: 5000 });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            headers: new Headers({ "Retry-After": "1" }),
            text: () => Promise.resolve(""),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
        });
      });

      await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
        method: "GET",
      });

      expect(callCount).toBe(2);
    });

    it("should not retry on 404 errors", async () => {
      setRetryConfig({ maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100, timeoutMs: 5000 });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: () => Promise.resolve(""),
        });
      });

      try {
        await vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "GET",
        });
      } catch {
        // Expected to throw
      }

      expect(callCount).toBe(1); // No retries for 404
    });

    it("should give up after max retries", async () => {
      setRetryConfig({ maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100, timeoutMs: 5000 });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve("Service down"),
        });
      });

      await expect(
        vfsRequest("myapp.azurewebsites.net", "/api/vfs/workflow.json", "master-key", {
          method: "GET",
        })
      ).rejects.toThrow(McpError);

      expect(callCount).toBe(3); // Initial + 2 retries, then gives up
    });
  });
});
