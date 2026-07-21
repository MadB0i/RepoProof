import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFs = {
  files: new Map<string, string>(),

  reset() {
    this.files.clear();
  },

  setFile(path: string, content: string) {
    this.files.set(path.replace(/\\/g, "/"), content);
  },
};

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    readFileSync: vi.fn((path: string, _encoding?: string) => {
      const n = path.replace(/\\/g, "/");
      if (mockFs.files.has(n)) return mockFs.files.get(n);
      throw new Error(`ENOENT: ${n}`);
    }),
    existsSync: vi.fn((path: string) => {
      return mockFs.files.has(path.replace(/\\/g, "/"));
    }),
  };
});

import { validateConfig, loadConfig, findConfig } from "../config/config-loader.js";

beforeEach(() => {
  mockFs.reset();
});

describe("loadConfig", () => {
  it("should return default config when no path provided", () => {
    const config = loadConfig();
    expect(config.minScore).toBe(70);
    expect(config.maxFileSize).toBe(1048576);
    expect(config.failOn).toBe("error");
  });

  it("should load and parse valid JSON config", () => {
    mockFs.setFile(
      "D:/Projects/RepoProof/.repoproof.json",
      JSON.stringify({ minScore: 80, maxFileSize: 500000 }),
    );

    const config = loadConfig("D:/Projects/RepoProof/.repoproof.json");
    expect(config.minScore).toBe(80);
    expect(config.maxFileSize).toBe(500000);
  });

  it("should load and parse JSONC config with comments", () => {
    mockFs.setFile(
      "D:/Projects/RepoProof/.repoproof.jsonc",
      [
        "{",
        "  // This is a comment",
        '  "minScore": 85,',
        "  /* block comment */",
        '  "maxFileSize": 200000',
        "}",
      ].join("\n"),
    );

    const config = loadConfig("D:/Projects/RepoProof/.repoproof.jsonc");
    expect(config.minScore).toBe(85);
    expect(config.maxFileSize).toBe(200000);
  });

  it("should handle trailing commas in JSONC", () => {
    mockFs.setFile(
      "D:/Projects/RepoProof/.repoproof.jsonc",
      '{\n  "minScore": 75,\n  "maxFileSize": 300000,\n}',
    );

    const config = loadConfig("D:/Projects/RepoProof/.repoproof.jsonc");
    expect(config.minScore).toBe(75);
  });

  it("should throw for missing config file", () => {
    expect(() => loadConfig("D:/Projects/RepoProof/nonexistent.json")).toThrow(
      "Configuration file not found",
    );
  });

  it("should throw for invalid JSON", () => {
    mockFs.setFile("D:/Projects/RepoProof/.repoproof.json", "{ invalid json }");
    expect(() => loadConfig("D:/Projects/RepoProof/.repoproof.json")).toThrow("Invalid JSON");
  });
});

describe("validateConfig", () => {
  it("should return default config for minimal valid input", () => {
    const config = validateConfig({});
    expect(config.minScore).toBe(70);
    expect(config.maxFileSize).toBe(1048576);
    expect(config.failOn).toBe("error");
  });

  it("should throw for non-object input", () => {
    expect(() => validateConfig(null)).toThrow("must be a non-null object");
    expect(() => validateConfig("string")).toThrow("must be a non-null object");
    expect(() => validateConfig(42)).toThrow("must be a non-null object");
  });

  it("should validate ignoredPaths as array of strings", () => {
    const config = validateConfig({ ignoredPaths: ["dist", "build"] });
    expect(config.ignoredPaths).toEqual(["dist", "build"]);
  });

  it("should throw for invalid ignoredPaths", () => {
    expect(() => validateConfig({ ignoredPaths: "not-array" })).toThrow(
      "'ignoredPaths' must be an array of strings",
    );
    expect(() => validateConfig({ ignoredPaths: [42] })).toThrow(
      "'ignoredPaths' must be an array of strings",
    );
  });

  it("should validate severityOverrides", () => {
    const config = validateConfig({ severityOverrides: { "todo-fixme": "error" } });
    expect(config.severityOverrides!["todo-fixme"]).toBe("error");
  });

  it("should throw for invalid severity", () => {
    expect(() => validateConfig({ severityOverrides: { "todo-fixme": "critical" } })).toThrow(
      "severityOverrides.todo-fixme",
    );
  });

  it("should validate penaltyOverrides", () => {
    const config = validateConfig({ penaltyOverrides: { "todo-fixme": 10 } });
    expect(config.penaltyOverrides!["todo-fixme"]).toBe(10);
  });

  it("should throw for negative penalty", () => {
    expect(() => validateConfig({ penaltyOverrides: { "todo-fixme": -5 } })).toThrow(
      "penaltyOverrides.todo-fixme",
    );
  });

  it("should validate minScore (0-100)", () => {
    const config = validateConfig({ minScore: 50 });
    expect(config.minScore).toBe(50);
  });

  it("should throw for minScore out of range", () => {
    expect(() => validateConfig({ minScore: -1 })).toThrow(
      "'minScore' must be a number between 0 and 100",
    );
    expect(() => validateConfig({ minScore: 101 })).toThrow(
      "'minScore' must be a number between 0 and 100",
    );
  });

  it("should validate failOn", () => {
    expect(validateConfig({ failOn: "error" }).failOn).toBe("error");
    expect(validateConfig({ failOn: "warning" }).failOn).toBe("warning");
  });

  it("should throw for invalid failOn", () => {
    expect(() => validateConfig({ failOn: "everything" })).toThrow(
      '\'failOn\' must be "error" or "warning"',
    );
  });

  it("should validate includedPaths", () => {
    const config = validateConfig({ includedPaths: ["src"] });
    expect(config.includedPaths).toEqual(["src"]);
  });

  it("should validate excludedPaths", () => {
    const config = validateConfig({ excludedPaths: ["tests"] });
    expect(config.excludedPaths).toEqual(["tests"]);
  });
});

describe("findConfig", () => {
  it("should find .repoproof.json", () => {
    mockFs.setFile("D:/Projects/RepoProof/.repoproof.json", "{}");

    const result = findConfig("D:/Projects/RepoProof");
    expect(result!.replace(/\\/g, "/")).toBe("D:/Projects/RepoProof/.repoproof.json");
  });

  it("should find .repoproof.jsonc", () => {
    mockFs.setFile("D:/Projects/RepoProof/.repoproof.jsonc", "{}");

    const result = findConfig("D:/Projects/RepoProof");
    expect(result!.replace(/\\/g, "/")).toBe("D:/Projects/RepoProof/.repoproof.jsonc");
  });

  it("should return null when no config file exists", () => {
    const result = findConfig("D:/Projects/RepoProof");
    expect(result).toBeNull();
  });

  it("should search parent directories", () => {
    mockFs.setFile("D:/Projects/.repoproof.json", "{}");

    const result = findConfig("D:/Projects/RepoProof/src");
    expect(result!.replace(/\\/g, "/")).toBe("D:/Projects/.repoproof.json");
  });
});
