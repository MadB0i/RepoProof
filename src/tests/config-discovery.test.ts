import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join } from "node:path";

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-discovery-repo");
const repoPath = (...segments: string[]) => normalizeMockPath(join(TEST_ROOT, ...segments));

const mockFs = {
  files: new Map<string, string>(),

  reset() {
    this.files.clear();
  },

  setFile(path: string, content: string) {
    this.files.set(normalizeMockPath(path), content);
  },
};

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    readFileSync: vi.fn((path: string, _encoding?: string) => {
      const n = normalizeMockPath(path);
      if (mockFs.files.has(n)) return mockFs.files.get(n);
      throw new Error(`ENOENT: ${n}`);
    }),
    existsSync: vi.fn((path: string) => {
      return mockFs.files.has(normalizeMockPath(path));
    }),
  };
});

import { loadConfig, findConfig, resolveConfigPath } from "../config/config-loader.js";

beforeEach(() => {
  mockFs.reset();
});

describe("findConfig dotfile discovery", () => {
  it("should find .repoproofrc", () => {
    mockFs.setFile(repoPath(".repoproofrc"), "{}");

    const result = findConfig(TEST_ROOT);
    expect(result!.replace(/\\/g, "/")).toBe(repoPath(".repoproofrc"));
  });

  it("should find .repoproofrc.json", () => {
    mockFs.setFile(repoPath(".repoproofrc.json"), "{}");

    const result = findConfig(TEST_ROOT);
    expect(result!.replace(/\\/g, "/")).toBe(repoPath(".repoproofrc.json"));
  });

  it("should return null when no config file exists (defaults apply)", () => {
    expect(findConfig(TEST_ROOT)).toBeNull();
    expect(loadConfig(findConfig(TEST_ROOT) ?? undefined).minScore).toBe(70);
  });

  it("should prefer existing names over .repoproofrc (order preserved)", () => {
    mockFs.setFile(repoPath(".repoproof.json"), "{}");
    mockFs.setFile(repoPath(".repoproofrc"), "{}");

    const result = findConfig(TEST_ROOT);
    expect(result!.replace(/\\/g, "/")).toBe(repoPath(".repoproof.json"));
  });

  it("should prefer repoproof.config.json over .repoproofrc.json", () => {
    mockFs.setFile(repoPath("repoproof.config.json"), "{}");
    mockFs.setFile(repoPath(".repoproofrc.json"), "{}");

    const result = findConfig(TEST_ROOT);
    expect(result!.replace(/\\/g, "/")).toBe(repoPath("repoproof.config.json"));
  });
});

describe("loadConfig rc files", () => {
  it("should parse .repoproofrc with comments (JSONC treatment)", () => {
    mockFs.setFile(
      repoPath(".repoproofrc"),
      ["{", "  // dotfile comment", '  "minScore": 80,', '  "failOn": "warning",', "}"].join("\n"),
    );

    const config = loadConfig(repoPath(".repoproofrc"));
    expect(config.minScore).toBe(80);
    expect(config.failOn).toBe("warning");
  });

  it("should load severity/penalty overrides from .repoproofrc (persisted weights)", () => {
    mockFs.setFile(
      repoPath(".repoproofrc"),
      JSON.stringify({
        severityOverrides: { "empty-function": "error" },
        penaltyOverrides: { "empty-function": 1 },
      }),
    );

    const config = loadConfig(repoPath(".repoproofrc"));
    expect(config.severityOverrides).toEqual({ "empty-function": "error" });
    expect(config.penaltyOverrides).toEqual({ "empty-function": 1 });
  });

  it("should throw a clear error for malformed .repoproofrc (loud, not silent)", () => {
    mockFs.setFile(repoPath(".repoproofrc"), "{ invalid json }");
    expect(() => loadConfig(repoPath(".repoproofrc"))).toThrow("Invalid JSONC");
  });

  it("should throw a clear error for malformed .repoproofrc.json", () => {
    mockFs.setFile(repoPath(".repoproofrc.json"), "{ invalid json }");
    expect(() => loadConfig(repoPath(".repoproofrc.json"))).toThrow("Invalid JSON");
  });

  it("should throw for explicitly given but missing file", () => {
    expect(() => loadConfig(repoPath(".repoproofrc"))).toThrow("Configuration file not found");
  });
});

describe("resolveConfigPath priority", () => {
  it("explicit --config wins over auto-discovery", () => {
    mockFs.setFile(repoPath(".repoproof.json"), "{}");

    expect(resolveConfigPath(repoPath("custom.json"), TEST_ROOT)).toBe(repoPath("custom.json"));
  });

  it("falls back to auto-discovered file", () => {
    mockFs.setFile(repoPath(".repoproofrc"), "{}");

    expect(resolveConfigPath(undefined, TEST_ROOT)!.replace(/\\/g, "/")).toBe(
      repoPath(".repoproofrc"),
    );
  });

  it("empty-string flag falls back to auto-discovery", () => {
    mockFs.setFile(repoPath(".repoproofrc"), "{}");

    expect(resolveConfigPath("", TEST_ROOT)!.replace(/\\/g, "/")).toBe(repoPath(".repoproofrc"));
  });

  it("returns null when nothing applies (defaults)", () => {
    expect(resolveConfigPath(undefined, TEST_ROOT)).toBeNull();
  });
});
