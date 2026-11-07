/**
 * Auth module barrel file.
 * Re-exports all auth-related functions.
 */

// Azure CLI exports (for local development and integration tests)
export { getAzureCliToken, checkAzureCliAuth } from "./azureCli.js";
export type { AzureCliToken } from "./azureCli.js";

// Token manager (passthrough token, plus Azure CLI fallback in local stdio mode)
export {
  getAccessToken,
  setSettings,
  initializeAuth,
  logout,
  enableLocalCliAuth,
  setPassthroughToken,
  clearPassthroughToken,
} from "./tokenManager.js";
