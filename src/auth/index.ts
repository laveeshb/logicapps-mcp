/**
 * Auth module barrel file.
 * Re-exports all auth-related functions.
 */

// Azure CLI exports (for local development and integration tests)
export { getAzureCliToken, checkAzureCliAuth } from "./azureCli.js";
export type { AzureCliToken } from "./azureCli.js";

// Token manager (passthrough-only authentication)
export {
  getAccessToken,
  setSettings,
  initializeAuth,
  logout,
  setPassthroughToken,
  clearPassthroughToken,
} from "./tokenManager.js";
