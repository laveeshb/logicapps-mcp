/**
 * Auth module barrel file.
 * Re-exports all auth-related functions.
 */

// Legacy Azure CLI exports (kept for backwards compatibility)
export {
  getAzureCliToken,
  checkAzureCliAuth,
} from "./azureCli.js";
export type { AzureCliToken } from "./azureCli.js";

// New Azure Identity exports (recommended)
export {
  getToken,
  checkAuth,
  clearCache,
} from "./azureIdentity.js";

// Token manager (uses Azure Identity internally)
export {
  getAccessToken,
  setSettings,
  initializeAuth,
  logout,
  setPassthroughToken,
  clearPassthroughToken,
} from "./tokenManager.js";
