import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join, relative } from "node:path";

interface MockStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
}

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-test-repo");
const repoPath = (...segments: string[]) => normalizeMockPath(join(TEST_ROOT, ...segments));

const mockFs = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  stats: new Map<string, MockStat>(),
  symlinks: new Map<string, string>(),

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.symlinks.clear();
    this.dirs.add(TEST_ROOT);
    this.stats.set(TEST_ROOT, {
      isFile: false,
      isDirectory: true,
      isSymbolicLink: false,
      size: 0,
    });
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
    const rel = relative(TEST_ROOT, n).replace(/\\/g, "/");
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

  addDir(path: string) {
    const n = normalizeMockPath(path);
    this.dirs.add(n);
    this.stats.set(n, { isFile: false, isDirectory: true, isSymbolicLink: false, size: 0 });
  },

  addSymlink(path: string) {
    const n = normalizeMockPath(path);
    this.symlinks.set(n, "/external/target");
    this.stats.set(n, { isFile: false, isDirectory: false, isSymbolicLink: true, size: 0 });
    const rel = relative(TEST_ROOT, n).replace(/\\/g, "/");
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
};

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    readFileSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
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
      return mockFs.files.has(n) || mockFs.dirs.has(n) || mockFs.symlinks.has(n);
    }),
  };
});

import { scanDirectory } from "../engine/scanner.js";
import type { RepoProofConfig } from "../types.js";

const defaultConfig: RepoProofConfig = { minScore: 70, maxFileSize: 1048576, failOn: "error" };

beforeEach(() => {
  mockFs.reset();
});

describe("ignore handling", () => {
  it("should respect .git directory", () => {
    mockFs.addFile(repoPath(".git/config"), "[core]");
    mockFs.addFile(repoPath(".git/HEAD"), "ref: main");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });

  it("should respect node_modules directory", () => {
    mockFs.addFile(repoPath("node_modules/express/index.js"), "module.exports = {};");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should ignore dist directory", () => {
    mockFs.addFile(repoPath("dist/bundle.js"), "// bundled");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should respect config ignoredPaths", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/vendor/lib.ts"), "// lib");
    mockFs.addFile(repoPath("docs/readme.md"), "# Docs");

    const config: RepoProofConfig = { ...defaultConfig, ignoredPaths: ["src/vendor"] };
    const results = scanDirectory(TEST_ROOT, config);

    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.relativePath).sort();
    expect(paths).toEqual(["docs/readme.md", "src/index.ts"]);
  });

  it("should ignore binary file extensions", () => {
    mockFs.addFile(repoPath("image.png"), "\u0089PNG\r\n\u001a\n");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });

  it("should ignore .exe and .dll binary extensions", () => {
    mockFs.addFile(repoPath("app.exe"), Buffer.alloc(100).toString());
    mockFs.addFile(repoPath("lib.dll"), Buffer.alloc(100).toString());
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should ignore __pycache__ directory", () => {
    mockFs.addFile(repoPath("__pycache__/main.cpython-311.pyc"), "cache");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should ignore vendor directory", () => {
    mockFs.addFile(repoPath("vendor/package/index.js"), "// vendored");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should skip symlinks", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addSymlink(repoPath("external_link"));

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should use forward slashes in relative paths (Windows-style compat)", () => {
    mockFs.addFile(repoPath("src/utils/helper.ts"), "// helper");
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    for (const r of results) {
      expect(r.relativePath).not.toContain("\\");
    }
  });

  it("should respect excludedPaths from config", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/experimental/new.ts"), "// new");
    mockFs.addFile(repoPath("src/main.ts"), "// main");

    const config: RepoProofConfig = { ...defaultConfig, excludedPaths: ["src/experimental"] };
    const results = scanDirectory(TEST_ROOT, config);

    expect(results).toHaveLength(2);
  });

  it("should respect includedPaths from config", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("tests/test.spec.ts"), "describe('test', () => {});");
    mockFs.addFile(repoPath("docs/readme.md"), "# Readme");

    const config: RepoProofConfig = { ...defaultConfig, includedPaths: ["src"] };
    const results = scanDirectory(TEST_ROOT, config);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });
});
