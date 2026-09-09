import { defineConfig } from "vitest/config";

export default defineConfig({
  // Enables native TSConfig path resolution, eliminating the need for path-mapping plugins
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Disables parallel file execution to prevent fixture collisions on a shared database
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
