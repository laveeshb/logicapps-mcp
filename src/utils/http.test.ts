import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vfsRequest } from "./http.js";
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
    });

    afterEach(() => {
      global.fetch = originalFetch;
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
});
