import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadSettings } from "./settings.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock os
vi.mock("node:os", () => ({
  homedir: vi.fn(),
}));

describe("settings", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");
    // Reset environment variables
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_CLOUD;
    delete process.env.LOGICAPPS_MCP_LOG_LEVEL;
    delete process.env.LOGICAPPS_MCP_CACHE_TTL;
    delete process.env.LOGICAPPS_MCP_READ_ONLY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("loadSettings", () => {
    it("should return default settings when no config file exists", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const settings = await loadSettings();

      expect(settings.tenantId).toBe("common");
      expect(settings.clientId).toBe("04b07795-8ddb-461a-bbee-02f9e1bf7b46");
      expect(settings.cloud.name).toBe("AzurePublic");
      expect(settings.logLevel).toBe("info");
      expect(settings.cacheTtlSeconds).toBe(300);
    });

    it("should load settings from config file", async () => {
      const configFile = {
        tenantId: "my-tenant",
        clientId: "my-client-id",
        defaultSubscriptionId: "my-sub",
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(configFile));

      const settings = await loadSettings();

      expect(settings.tenantId).toBe("my-tenant");
      expect(settings.clientId).toBe("my-client-id");
      expect(settings.defaultSubscriptionId).toBe("my-sub");
    });

    it("should prefer environment variables over config file", async () => {
      process.env.AZURE_TENANT_ID = "env-tenant";
      process.env.AZURE_CLIENT_ID = "env-client";
      process.env.AZURE_SUBSCRIPTION_ID = "env-sub";

      const configFile = {
        tenantId: "config-tenant",
        clientId: "config-client",
        defaultSubscriptionId: "config-sub",
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(configFile));

      const settings = await loadSettings();

      expect(settings.tenantId).toBe("env-tenant");
      expect(settings.clientId).toBe("env-client");
      expect(settings.defaultSubscriptionId).toBe("env-sub");
    });

    it("should use custom cloud from config file", async () => {
      const customCloud = {
        name: "CustomCloud",
        authentication: {
          loginEndpoint: "https://custom.login.com",
          tokenAudience: "https://custom.api.com",
        },
        resourceManager: "https://custom.management.com",
        suffixes: {
          azureWebsites: ".custom.com",
        },
      };
      const configFile = { customCloud };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(configFile));

      const settings = await loadSettings();

      expect(settings.cloud).toEqual(customCloud);
    });

    it("should respect AZURE_CLOUD environment variable", async () => {
      process.env.AZURE_CLOUD = "AzureGovernment";
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const settings = await loadSettings();

      expect(settings.cloud.name).toBe("AzureGovernment");
    });

    it("should parse LOGICAPPS_MCP_LOG_LEVEL environment variable", async () => {
      process.env.LOGICAPPS_MCP_LOG_LEVEL = "debug";
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const settings = await loadSettings();

      expect(settings.logLevel).toBe("debug");
    });

    it("should parse LOGICAPPS_MCP_CACHE_TTL environment variable", async () => {
      process.env.LOGICAPPS_MCP_CACHE_TTL = "600";
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const settings = await loadSettings();

      expect(settings.cacheTtlSeconds).toBe(600);
    });
  });

  describe("readOnly", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("is off by default", async () => {
      expect((await loadSettings()).readOnly).toBe(false);
    });

    it.each(["true", "TRUE", " true ", "1", "yes", "on"])(
      "is on for LOGICAPPS_MCP_READ_ONLY=%j, without a warning",
      async (value) => {
        process.env.LOGICAPPS_MCP_READ_ONLY = value;
        expect((await loadSettings()).readOnly).toBe(true);
        expect(errorSpy).not.toHaveBeenCalled();
      }
    );

    it.each(["false", "FALSE", "0", "no", "off"])(
      "is off for LOGICAPPS_MCP_READ_ONLY=%j, without a warning",
      async (value) => {
        process.env.LOGICAPPS_MCP_READ_ONLY = value;
        expect((await loadSettings()).readOnly).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
      }
    );

    it("turns on for a value it does not recognise, with a warning", async () => {
      process.env.LOGICAPPS_MCP_READ_ONLY = "ture";

      expect((await loadSettings()).readOnly).toBe(true);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("treats an empty LOGICAPPS_MCP_READ_ONLY as not set", async () => {
      process.env.LOGICAPPS_MCP_READ_ONLY = "";

      // Not set, so the config file decides, in both directions.
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: false }));
      expect((await loadSettings()).readOnly).toBe(false);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: true }));
      expect((await loadSettings()).readOnly).toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("reads readOnly from the config file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: true }));
      expect((await loadSettings()).readOnly).toBe(true);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: false }));
      expect((await loadSettings()).readOnly).toBe(false);
    });

    it("accepts the same words in the config file as a string", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: "true" }));
      expect((await loadSettings()).readOnly).toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("turns on for a config file value it does not recognise, with a warning", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: 5 }));

      expect((await loadSettings()).readOnly).toBe(true);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("prefers the environment variable over the config file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ readOnly: true }));
      process.env.LOGICAPPS_MCP_READ_ONLY = "false";
      expect((await loadSettings()).readOnly).toBe(false);
    });

    it("says so when the config file is not valid JSON", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ "readOnly": true, }');

      expect((await loadSettings()).readOnly).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not valid JSON"));
    });
  });
});
