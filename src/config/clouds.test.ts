import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AZURE_CLOUDS, getCloudEndpoints, AzureCloudEndpoints } from "./clouds.js";

describe("clouds", () => {
  describe("AZURE_CLOUDS", () => {
    it("should have AzurePublic cloud configuration", () => {
      expect(AZURE_CLOUDS.AzurePublic).toBeDefined();
      expect(AZURE_CLOUDS.AzurePublic.name).toBe("AzurePublic");
      expect(AZURE_CLOUDS.AzurePublic.authentication.loginEndpoint).toBe(
        "https://login.microsoftonline.com"
      );
      expect(AZURE_CLOUDS.AzurePublic.resourceManager).toBe("https://management.azure.com");
    });

    it("should have AzureGovernment cloud configuration", () => {
      expect(AZURE_CLOUDS.AzureGovernment).toBeDefined();
      expect(AZURE_CLOUDS.AzureGovernment.name).toBe("AzureGovernment");
      expect(AZURE_CLOUDS.AzureGovernment.authentication.loginEndpoint).toBe(
        "https://login.microsoftonline.us"
      );
      expect(AZURE_CLOUDS.AzureGovernment.resourceManager).toBe(
        "https://management.usgovcloudapi.net"
      );
    });

    it("should have AzureChina cloud configuration", () => {
      expect(AZURE_CLOUDS.AzureChina).toBeDefined();
      expect(AZURE_CLOUDS.AzureChina.name).toBe("AzureChina");
      expect(AZURE_CLOUDS.AzureChina.authentication.loginEndpoint).toBe(
        "https://login.chinacloudapi.cn"
      );
    });

    it("should have correct structure for all clouds", () => {
      const requiredKeys: (keyof AzureCloudEndpoints)[] = [
        "name",
        "authentication",
        "resourceManager",
        "suffixes",
      ];

      for (const cloudName of Object.keys(AZURE_CLOUDS)) {
        const cloud = AZURE_CLOUDS[cloudName];
        for (const key of requiredKeys) {
          expect(cloud[key]).toBeDefined();
        }
        expect(cloud.authentication.loginEndpoint).toBeDefined();
        expect(cloud.authentication.tokenAudience).toBeDefined();
        expect(cloud.suffixes.azureWebsites).toBeDefined();
      }
    });
  });

  describe("getCloudEndpoints", () => {
    const originalEnv = process.env.AZURE_CLOUD;

    beforeEach(() => {
      delete process.env.AZURE_CLOUD;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.AZURE_CLOUD = originalEnv;
      } else {
        delete process.env.AZURE_CLOUD;
      }
    });

    it("should return AzurePublic by default", () => {
      const cloud = getCloudEndpoints();
      expect(cloud.name).toBe("AzurePublic");
    });

    it("should return specified cloud by name", () => {
      const cloud = getCloudEndpoints("AzureGovernment");
      expect(cloud.name).toBe("AzureGovernment");
    });

    it("should respect AZURE_CLOUD environment variable", () => {
      process.env.AZURE_CLOUD = "AzureChina";
      const cloud = getCloudEndpoints();
      expect(cloud.name).toBe("AzureChina");
    });

    it("should prefer explicit parameter over environment variable", () => {
      process.env.AZURE_CLOUD = "AzureChina";
      const cloud = getCloudEndpoints("AzureGovernment");
      expect(cloud.name).toBe("AzureGovernment");
    });

    it("should throw for unknown cloud name", () => {
      expect(() => getCloudEndpoints("UnknownCloud")).toThrow(/Unknown Azure cloud: UnknownCloud/);
    });
  });
});
