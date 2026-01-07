/**
 * Package version - read from package.json at build time.
 * This avoids hardcoding the version in multiple places.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

function getPackageVersion(): string {
  try {
    // Get the directory of this file (dist/src/ after build)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Navigate up to find package.json (could be 2 or 3 levels up)
    const paths = [
      join(__dirname, "..", "package.json"), // src/ -> root
      join(__dirname, "..", "..", "package.json"), // dist/src/ -> root
    ];

    for (const pkgPath of paths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        // Try next path
      }
    }

    return "0.0.0"; // Fallback
  } catch {
    return "0.0.0"; // Fallback
  }
}

export const VERSION = getPackageVersion();
