import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { performScan } from "../engine/scan.js";

// Uses the real checked-in fixture as scan input (no mocks). performScan
// performs no console output, history writes, or process exits.
describe("performScan", () => {
  it("should scan a directory and build a report", async () => {
    const target = resolve("src/good-fixture");
    const { report, config, resolvedPath, fileCount, ruleCount } = await performScan({
      targetPath: target,
    });

    expect(resolvedPath).toBe(target);
    expect(fileCount).toBeGreaterThan(0);
    expect(ruleCount).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThan(0);
    expect(report.grade).toMatch(/^[A-F]$/);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(config.minScore).toBe(70);
  });

  it("should throw a tool error for a missing path", async () => {
    await expect(performScan({ targetPath: "no-such-dir-xyz" })).rejects.toThrow("Path not found");
  });

  it("should respect an explicit config path", async () => {
    const { config } = await performScan({
      targetPath: resolve("src/good-fixture"),
      configPath: resolve(".repoproof.ci.jsonc"),
    });

    expect(config.minScore).toBe(90);
  });
});
