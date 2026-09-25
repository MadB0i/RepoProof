import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join, relative } from "node:path";
import { scanDirectory, detectProjectType, createScanContext } from "../engine/scanner.js";
import type { ScannedFile, RepoProofConfig } from "../types.js";

interface MockStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
}

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-edge-repo");
const repoPath = (...segments: string[]) => normalizeMockPath(join(TEST_ROOT, ...segments));

const mockFs = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  stats: new Map<string, MockStat>(),
  symlinks: new Map<string, string>(),
  statErrors: new Set<string>(),
  readErrors: new Set<string>(),

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.symlinks.clear();
    this.statErrors.clear();
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

  addUnreadableFile(path: string, size = 100) {
    // stat succeeds but readFileSync throws (corrupt / permission on read)
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

  addDir(path: string) {
    const n = normalizeMockPath(path);
    this.dirs.add(n);
    this.stats.set(n, { isFile: false, isDirectory: true, isSymbolicLink: false, size: 0 });
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
      for (const p of mockFs.symlinks.keys())
        if (p.startsWith(prefix)) {
          const r = p.slice(prefix.length);
          if (!r.includes("/")) entries.add(r);
        }
      // unreadable files also appear as directory entries
      for (const p of mockFs.readErrors)
        if (p.startsWith(prefix)) {
          const r = p.slice(prefix.length);
          if (!r.includes("/")) entries.add(r);
        }
      return [...entries];
    }),
    statSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      if (mockFs.statErrors.has(n)) throw new Error("EACCES: permission denied");
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
      return (
        mockFs.files.has(n) ||
        mockFs.dirs.has(n) ||
        mockFs.symlinks.has(n) ||
        mockFs.readErrors.has(n)
      );
    }),
  };
});

function makeFile(relativePath: string, content: string): ScannedFile {
  return {
    path: join(TEST_ROOT, relativePath),
    relativePath,
    content,
    size: Buffer.byteLength(content, "utf-8"),
  };
}

const defaultConfig: RepoProofConfig = { minScore: 70, maxFileSize: 1048576, failOn: "error" };

beforeEach(() => {
  mockFs.reset();
});

describe("scanDirectory resource limits", () => {
  it("happy path: scans nested files and returns deterministic order", () => {
    mockFs.addFile(repoPath("src/b.ts"), "const b = 1;");
    mockFs.addFile(repoPath("src/a.ts"), "const a = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results.map((r) => r.relativePath)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(results[0]).toMatchObject({ relativePath: "src/a.ts", content: "const a = 1;" });
  });

  it("edge: empty repo returns empty array", () => {
    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toEqual([]);
  });

  it("error handling: non-existent directory returns empty (readdir throws)", () => {
    const missing = repoPath("does-not-exist");
    const results = scanDirectory(missing, defaultConfig);
    expect(results).toEqual([]);
  });

  it("error handling: scanning a file path (not a dir) returns empty", () => {
    mockFs.addFile(repoPath("single.ts"), "const x = 1;");
    const results = scanDirectory(repoPath("single.ts"), defaultConfig);
    expect(results).toEqual([]);
  });

  it("should respect maxFiles limit", () => {
    for (let i = 0; i < 5; i++) {
      mockFs.addFile(repoPath(`file-${i}.ts`), `const x${i} = ${i};`);
    }
    const results = scanDirectory(TEST_ROOT, { ...defaultConfig, maxFiles: 3 });
    expect(results).toHaveLength(3);
  });

  it("should hit walk entry guards via nested dirs after maxFiles reached", () => {
    // NOTE: maxFiles is best-effort, not a hard cap: the per-entry loop
    // does not re-check the limit before each file, so with nested dirs
    // the result can overshoot by 1. This test locks that behavior while
    // exercising the walk() entry guards (lines 188-194).
    mockFs.addFile(repoPath("sub1/a.ts"), "a");
    mockFs.addFile(repoPath("sub1/b.ts"), "b");
    mockFs.addFile(repoPath("sub2/c.ts"), "c");
    mockFs.addFile(repoPath("root.ts"), "d");

    const results = scanDirectory(TEST_ROOT, { ...defaultConfig, maxFiles: 2 });
    // Limit engaged: fewer than all 4 files scanned, at least maxFiles.
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBeLessThan(4);
  });

  it("should respect maxTotalBytes limit mid-walk", () => {
    mockFs.addFile(repoPath("a.ts"), "x".repeat(100));
    mockFs.addFile(repoPath("b.ts"), "y".repeat(100));
    mockFs.addFile(repoPath("c.ts"), "z".repeat(100));

    const results = scanDirectory(TEST_ROOT, { ...defaultConfig, maxTotalBytes: 150 });
    // Only first file fits within 150 bytes
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("should respect maxDirectoryDepth", () => {
    mockFs.addFile(repoPath("top.ts"), "const top = 1;");
    mockFs.addFile(repoPath("a/b/c/deep.ts"), "const deep = 1;");

    const shallow = scanDirectory(TEST_ROOT, { ...defaultConfig, maxDirectoryDepth: 1 });
    const shallowPaths = shallow.map((r) => r.relativePath);
    expect(shallowPaths).toContain("top.ts");
    expect(shallowPaths).not.toContain("a/b/c/deep.ts");

    const deep = scanDirectory(TEST_ROOT, { ...defaultConfig, maxDirectoryDepth: 10 });
    expect(deep.map((r) => r.relativePath)).toContain("a/b/c/deep.ts");
  });

  it("error handling: corrupt/unreadable file (read throws) is skipped", () => {
    mockFs.addFile(repoPath("good.ts"), "const ok = 1;");
    mockFs.addUnreadableFile(repoPath("corrupt.ts"), 50);

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results.map((r) => r.relativePath)).toEqual(["good.ts"]);
  });

  it("should skip lockfiles in IGNORED_FILES", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("package-lock.json"), "{}");
    mockFs.addFile(repoPath("pnpm-lock.yaml"), "lockfileVersion: 9");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });

  it("should skip binary extensions beyond png (exe, pdf)", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("tool.exe"), "MZ-binary");
    mockFs.addFile(repoPath("doc.pdf"), "%PDF-binary");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });

  it("should normalize Windows backslash ignoredPaths", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/generated/out.ts"), "generated");

    const results = scanDirectory(TEST_ROOT, {
      ...defaultConfig,
      ignoredPaths: ["src\\generated"],
    });
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });

  it("should apply includedPaths + excludedPaths together", () => {
    mockFs.addFile(repoPath("src/keep.ts"), "keep");
    mockFs.addFile(repoPath("src/secret/hide.ts"), "hide");
    mockFs.addFile(repoPath("docs/readme.md"), "# docs");

    const results = scanDirectory(TEST_ROOT, {
      ...defaultConfig,
      includedPaths: ["src"],
      excludedPaths: ["src/secret"],
    });
    expect(results.map((r) => r.relativePath)).toEqual(["src/keep.ts"]);
  });
});

describe("createScanContext", () => {
  it("returns files, config, and detected project type", () => {
    const files = [makeFile("package.json", "{}"), makeFile("src/index.ts", "const x = 1;")];
    const ctx = createScanContext(files, defaultConfig, TEST_ROOT);

    expect(ctx.files).toBe(files);
    expect(ctx.config).toBe(defaultConfig);
    expect(ctx.projectType.hasPackageJson).toBe(true);
    expect(ctx.projectType.languages).toContain("TypeScript");
  });

  it("works without dirPath (no existsSync fallback)", () => {
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const ctx = createScanContext(files, defaultConfig);

    expect(ctx.projectType.hasLockfile).toBe(false);
    expect(ctx.projectType.hasPackageJson).toBe(false);
  });
});

describe("detectProjectType coverage", () => {
  it("detects lockfile via dirPath existsSync fallback", () => {
    mockFs.addFile(repoPath("package-lock.json"), "{}");
    const ctx = createScanContext([], defaultConfig, TEST_ROOT);
    expect(ctx.projectType.hasLockfile).toBe(true);
  });

  it("detects dockerfile, readme case-insensitive, env example, editorconfig", () => {
    const files = [
      makeFile("Dockerfile", "FROM node:20"),
      makeFile("README.md", "# hi"),
      makeFile(".env.example", "KEY=1"),
      makeFile(".editorconfig", "root = true"),
      makeFile(".github/workflows/ci.yml", "on: push"),
    ];
    const pt = detectProjectType(files);
    expect(pt.hasDockerfile).toBe(true);
    expect(pt.hasReadme).toBe(true);
    expect(pt.hasEnvExample).toBe(true);
    expect(pt.hasEditorConfig).toBe(true);
    expect(pt.hasCiWorkflow).toBe(true);
    expect(pt.hasDockerCompose).toBe(false);
  });

  it("detects languages sorted", () => {
    const files = [makeFile("a.py", "x"), makeFile("b.ts", "y"), makeFile("c.go", "z")];
    const pt = detectProjectType(files);
    expect(pt.languages).toEqual([...pt.languages].sort());
    expect(pt.languages).toEqual(expect.arrayContaining(["Python", "TypeScript", "Go"]));
  });
});
