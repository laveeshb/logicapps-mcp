/**
 * Tests for the token manager: passthrough token, and the Azure CLI fallback
 * that is only enabled in local stdio mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetAzureCliToken = vi.fn();

vi.mock("./azureCli.js", () => ({
  getAzureCliToken: mockGetAzureCliToken,
}));

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

function cliToken(accessToken: string, expiresInMs: number) {
  return {
    accessToken,
    expiresOn: new Date(NOW + expiresInMs),
    subscription: "sub",
    tenant: "tenant",
    tokenType: "Bearer",
  };
}

// Module state is global, so load a fresh copy for each test.
async function load() {
  vi.resetModules();
  return import("./tokenManager.js");
}

describe("tokenManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockGetAzureCliToken.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the passthrough token without calling Azure CLI", async () => {
    const tm = await load();
    tm.enableLocalCliAuth();
    tm.setPassthroughToken("client-token");

    expect(await tm.getAccessToken()).toBe("client-token");
    expect(mockGetAzureCliToken).not.toHaveBeenCalled();
  });

  it("throws when no passthrough token is set and local mode is off", async () => {
    const tm = await load();

    await expect(tm.getAccessToken()).rejects.toThrow("Bearer token required");
    expect(mockGetAzureCliToken).not.toHaveBeenCalled();
  });

  it("falls back to Azure CLI in local mode", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    expect(await tm.getAccessToken()).toBe("cli-token");
  });

  it("reuses the Azure CLI token until close to expiry", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    await tm.getAccessToken();
    vi.setSystemTime(NOW + 30 * 60 * 1000);
    await tm.getAccessToken();

    expect(mockGetAzureCliToken).toHaveBeenCalledTimes(1);
  });

  it("still reuses the Azure CLI token with 6 minutes left", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    await tm.getAccessToken();
    vi.setSystemTime(NOW + 54 * 60 * 1000);
    await tm.getAccessToken();

    expect(mockGetAzureCliToken).toHaveBeenCalledTimes(1);
  });

  it("asks Azure CLI for the token audience of the configured cloud", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    vi.stubEnv("AZURE_CLOUD", "AzureGovernment");
    try {
      const tm = await load();
      tm.enableLocalCliAuth();
      await tm.getAccessToken();
    } finally {
      vi.unstubAllEnvs();
    }

    expect(mockGetAzureCliToken).toHaveBeenCalledWith("https://management.usgovcloudapi.net");
  });

  it("fetches a new Azure CLI token within 5 minutes of expiry", async () => {
    mockGetAzureCliToken
      .mockResolvedValueOnce(cliToken("old", 60 * 60 * 1000))
      .mockResolvedValueOnce(cliToken("new", 2 * 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    expect(await tm.getAccessToken()).toBe("old");
    vi.setSystemTime(NOW + 56 * 60 * 1000);
    expect(await tm.getAccessToken()).toBe("new");
    expect(mockGetAzureCliToken).toHaveBeenCalledTimes(2);
  });

  it("runs one Azure CLI call for parallel requests", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    const tokens = await Promise.all([
      tm.getAccessToken(),
      tm.getAccessToken(),
      tm.getAccessToken(),
    ]);

    expect(tokens).toEqual(["cli-token", "cli-token", "cli-token"]);
    expect(mockGetAzureCliToken).toHaveBeenCalledTimes(1);
  });

  it("passes Azure CLI errors through and retries on the next call", async () => {
    mockGetAzureCliToken
      .mockRejectedValueOnce(new Error("Not logged in to Azure CLI. Please run: az login"))
      .mockResolvedValueOnce(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    await expect(tm.getAccessToken()).rejects.toThrow("az login");
    expect(await tm.getAccessToken()).toBe("cli-token");
  });

  it("logout drops the cached Azure CLI token", async () => {
    mockGetAzureCliToken.mockResolvedValue(cliToken("cli-token", 60 * 60 * 1000));
    const tm = await load();
    tm.enableLocalCliAuth();

    await tm.getAccessToken();
    await tm.logout();
    await tm.getAccessToken();

    expect(mockGetAzureCliToken).toHaveBeenCalledTimes(2);
  });
});
