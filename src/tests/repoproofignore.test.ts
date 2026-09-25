import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join, relative } from "node:path";
import {
  parseIgnoreFile,
  loadIgnoreFile,
  matchIgnorePattern,
  isIgnoredByPatterns,
  IGNORE_FILENAME,
} from "../config/ignore-file.js";

interface MockStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
}

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-ignore-repo");
const repoPath = (...segments: string[]) => normalizeMockPath(join(TEST_ROOT, ...segments));

const mockFs = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  stats: new Map<string, MockStat>(),
  readErrors: new Set<string>(),

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.readErrors.clear();
    this.dirs.add(TEST_ROOT);
    this.stats.set(TEST_ROOT, {
      isFile: false,
      isDirectory: true,
      isSymbolicLink: false,
      size: 0,
    });
  },

  ensureParentDirs(normalizedFilePath: string) {
    const rel = relative(TEST_ROOT, normalizedFilePath).replace(/\\/g, "/");
    if (rel) {
      const parts = rel.split("/");
      let acc = TEST_ROOT;
      for (let i = 0; i < parts.length - 1; i++) {
        acc += "/" + parts[i];
        if (!this.dirs.has(acc)) {
          this.dirs.add(acc);
          this.stats.set(acc, { isFile: false, isDirectory: true, isSymbolicLink: false, size: 0 });
        }
      }
    }
  },

  addFile(path: string, content: string) {
    const n = normalizeMockPath(path);
    this.files.set(n, content);
    this.stats.set(n, {
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      size: Buffer.byteLength(content),
    });
    this.ensureParentDirs(n);
  },

  addUnreadableFile(path: string, size = 50) {
    const n = normalizeMockPath(path);
    this.stats.set(n, {
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      size,
    });
    this.readErrors.add(n);
    this.ensureParentDirs(n);
  },
};

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    readFileSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      if (mockFs.readErrors.has(n)) throw new Error(`EACCES: read denied ${n}`);
      if (mockFs.files.has(n)) return mockFs.files.get(n);
      throw new Error(`ENOENT: ${n}`);
    }),
    readdirSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      if (!mockFs.dirs.has(n)) throw new Error(`ENOENT: ${n}`);
      const prefix = n + "/";
      const entries = new Set<string>();
      for (const p of mockFs.dirs)
        if (p.startsWith(prefix) && p !== n) {
          const r = p.slice(prefix.length);
          if (!r.includes("/")) entries.add(r);
        }
      for (const p of mockFs.files.keys())
        if (p.startsWith(prefix)) {
          const r = p.slice(prefix.length);
          if (!r.includes("/")) entries.add(r);
        }
      for (const p of mockFs.readErrors)
        if (p.startsWith(prefix)) {
          const r = p.slice(prefix.length);
          if (!r.includes("/")) entries.add(r);
        }
      return [...entries];
    }),
    statSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      const stat = mockFs.stats.get(n);
      if (!stat) throw new Error(`ENOENT: ${n}`);
      return {
        isFile: () => stat.isFile,
        isDirectory: () => stat.isDirectory,
        isSymbolicLink: () => stat.isSymbolicLink,
        size: stat.size,
      };
    }),
    existsSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      return mockFs.files.has(n) || mockFs.dirs.has(n) || mockFs.readErrors.has(n);
    }),
  };
});

import { scanDirectory } from "../engine/scanner.js";
import type { RepoProofConfig } from "../types.js";

const defaultConfig: RepoProofConfig = { minScore: 70, maxFileSize: 1048576, failOn: "error" };

beforeEach(() => {
  mockFs.reset();
});

describe("parseIgnoreFile", () => {
  it("should skip blanks, comments, and negation lines", () => {
    const patterns = parseIgnoreFile("# comment\n\n*.log\n!important.log\n   \n#x\ndist/\n");
    expect(patterns).toEqual(["*.log", "dist/"]);
  });

  it("should normalize backslashes and leading ./ or /", () => {
    const patterns = parseIgnoreFile("src\\generated\n./local.tmp\n/output.bin\n");
    expect(patterns).toEqual(["src/generated", "local.tmp", "output.bin"]);
  });

  it("should return empty array for empty content", () => {
    expect(parseIgnoreFile("")).toEqual([]);
    expect(parseIgnoreFile("\n# only comments\n")).toEqual([]);
  });
});

describe("matchIgnorePattern", () => {
  it("should match exact files and dir prefixes", () => {
    expect(matchIgnorePattern("secret.txt", "secret.txt")).toBe(true);
    // No-slash patterns match the basename at any depth (gitignore rule).
    expect(matchIgnorePattern("secret.txt", "sub/secret.txt")).toBe(true);
    expect(matchIgnorePattern("secret.txt", "sub/secret.txt.bak")).toBe(false);
    expect(matchIgnorePattern("fixtures/data.json", "fixtures/data.json")).toBe(true);
    expect(matchIgnorePattern("fixtures/data.json", "other/fixtures/data.json")).toBe(false);
    expect(matchIgnorePattern("fixtures", "fixtures/data.json")).toBe(true);
  });

  it("should match trailing-slash dir patterns with contents", () => {
    expect(matchIgnorePattern("generated/", "generated")).toBe(true);
    expect(matchIgnorePattern("generated/", "generated/out.js")).toBe(true);
    expect(matchIgnorePattern("generated/", "src/generated")).toBe(false);
  });

  it("should match bare names at any depth", () => {
    expect(matchIgnorePattern("build", "build")).toBe(true);
    expect(matchIgnorePattern("build", "src/build/out.js")).toBe(true);
    expect(matchIgnorePattern("build", "rebuild/out.js")).toBe(false);
  });

  it("should match basename globs at any depth", () => {
    expect(matchIgnorePattern("*.log", "app.log")).toBe(true);
    expect(matchIgnorePattern("*.log", "a/b/c.log")).toBe(true);
    expect(matchIgnorePattern("*.log", "a/b/c.ts")).toBe(false);
    expect(matchIgnorePattern("?.tmp", "a.tmp")).toBe(true);
    expect(matchIgnorePattern("?.tmp", "ab.tmp")).toBe(false);
  });

  it("should support ** across directories", () => {
    expect(matchIgnorePattern("**/dist-info", "dist-info")).toBe(true);
    expect(matchIgnorePattern("**/dist-info", "a/b/dist-info")).toBe(true);
    expect(matchIgnorePattern("src/**/gen.ts", "src/a/b/gen.ts")).toBe(true);
    expect(matchIgnorePattern("src/**/gen.ts", "src/gen.ts")).toBe(true);
    expect(matchIgnorePattern("src/*.ts", "src/a/b.ts")).toBe(false);
  });

  it("isIgnoredByPatterns should return true on any match", () => {
    expect(isIgnoredByPatterns(["*.log", "dist/"], "a/b.log")).toBe(true);
    expect(isIgnoredByPatterns(["*.log", "dist/"], "src/index.ts")).toBe(false);
    expect(isIgnoredByPatterns([], "src/index.ts")).toBe(false);
  });
});

describe("loadIgnoreFile", () => {
  it("should return [] when file is absent", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    expect(loadIgnoreFile(TEST_ROOT)).toEqual([]);
  });

  it("should parse patterns when file is present", () => {
    mockFs.addFile(repoPath(IGNORE_FILENAME), "*.log\n# c\ndist/\n");
    expect(loadIgnoreFile(TEST_ROOT)).toEqual(["*.log", "dist/"]);
  });

  it("should return [] when file is unreadable instead of throwing", () => {
    mockFs.addUnreadableFile(repoPath(IGNORE_FILENAME));
    expect(loadIgnoreFile(TEST_ROOT)).toEqual([]);
  });
});

describe("scanner + .repoproofignore integration", () => {
  it("absent ignore file leaves scan unaffected", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("app.log"), "log");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath).sort()).toEqual(["app.log", "src/index.ts"]);
  });

  it("glob patterns exclude matching files at any depth", () => {
    mockFs.addFile(repoPath(IGNORE_FILENAME), "*.log\n");
    mockFs.addFile(repoPath("app.log"), "log");
    mockFs.addFile(repoPath("src/debug.log"), "log");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    // ignore file itself is still scanned; only *.log files are excluded
    expect(results.map((r) => r.relativePath).sort()).toEqual([".repoproofignore", "src/index.ts"]);
  });

  it("directory patterns exclude the dir and its contents", () => {
    mockFs.addFile(repoPath(IGNORE_FILENAME), "generated/\n");
    mockFs.addFile(repoPath("generated/out.js"), "gen");
    mockFs.addFile(repoPath("generated/nested/deep.js"), "gen");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath).sort()).toEqual([".repoproofignore", "src/index.ts"]);
  });

  it("config ignoredPaths and ignore file merge additively (union)", () => {
    mockFs.addFile(repoPath(IGNORE_FILENAME), "from-ignore/\n");
    mockFs.addFile(repoPath("from-ignore/a.ts"), "a");
    mockFs.addFile(repoPath("from-config/b.ts"), "b");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const config: RepoProofConfig = { ...defaultConfig, ignoredPaths: ["from-config"] };
    const results = scanDirectory(TEST_ROOT, config);
    expect(results.map((r) => r.relativePath).sort()).toEqual([".repoproofignore", "src/index.ts"]);
  });

  it("config cannot re-include what the ignore file excludes (no override)", () => {
    // Config has no mechanism to cancel ignore-file patterns: there is no
    // `includedPaths` interplay — includedPaths only narrows the scan root
    // set, ignore patterns still apply on top.
    mockFs.addFile(repoPath(IGNORE_FILENAME), "secret/\n");
    mockFs.addFile(repoPath("secret/key.ts"), "key");
    mockFs.addFile(repoPath("secret/other.ts"), "other");

    const config: RepoProofConfig = { ...defaultConfig, includedPaths: ["secret"] };
    const results = scanDirectory(TEST_ROOT, config);
    expect(results).toEqual([]);
  });

  it("unreadable ignore file does not break the scan", () => {
    mockFs.addUnreadableFile(repoPath(IGNORE_FILENAME));
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });

  it("RepoProof's own .repoproof data dir is never scanned", () => {
    mockFs.addFile(repoPath(".repoproof/history.json"), "{}");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });
});
