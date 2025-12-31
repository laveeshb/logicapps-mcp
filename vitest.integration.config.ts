import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30000, // 30 seconds for API calls
    hookTimeout: 60000, // 60 seconds for setup/teardown
    // Run integration tests sequentially to avoid rate limiting
    sequence: {
      concurrent: false,
    },
    maxConcurrency: 1,
  },
});
