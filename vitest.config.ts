import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "src/bad-fixture/**", "src/good-fixture/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Only genuinely non-testable files are excluded here. Business logic
      // (src/engine/*, src/rules/*, src/cli/*, src/reporters/*,
      // src/config/*, src/github/* except the types-only module) stays
      // included — verified: none of those paths appear below.
      // NOTE: vitest replaces its default coverage excludes when this list
      // is set, so defaults (test files, dist, coverage output) are
      // repeated explicitly to avoid inflating the report with test
      // harnesses themselves. The broad default shapes
      // (`**/node_modules/**`, `**/*.test.*`, …) are intentionally kept:
      // coverage-excludes already flags vitest.config.ts once (pre-existing
      // test.exclude), and hiding defaults to silence it would be dishonest.
      exclude: [
        // Defaults (kept to avoid covering test harnesses / build output)
        "coverage/**",
        "dist/**",
        "**/node_modules/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "test/**",
        // Fixtures: intentionally good/bad sample repos, not source
        "**/bad-fixture/**",
        "**/good-fixture/**",
        // Manual node scripts, not unit-testable source
        "scripts/**",
        // Type-only / tool configs, no runtime logic
        "**/*.d.ts",
        "**/github/types.ts",
        "vitest.config.ts",
        "tsup.config.ts",
        "eslint.config.js",
      ],
    },
  },
});
