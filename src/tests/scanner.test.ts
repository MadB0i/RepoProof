import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join, relative } from "node:path";
import { scanDirectory, detectProjectType } from "../engine/scanner.js";
import type { ScannedFile, RepoProofConfig } from "../types.js";

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
  statErrors: new Set<string>(),

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.symlinks.clear();
    this.statErrors.clear();
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
      return mockFs.files.has(n) || mockFs.dirs.has(n) || mockFs.symlinks.has(n);
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

describe("scanDirectory", () => {
  it("should scan basic files in a directory", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/utils.ts"), "export function foo() {}");
    mockFs.addFile(repoPath("package.json"), "{}");

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results).toHaveLength(3);
    const paths = results.map((r) => r.relativePath).sort();
    expect(paths).toEqual(["package.json", "src/index.ts", "src/utils.ts"]);
  });

  it("should ignore .git, node_modules, dist directories", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("node_modules/express/index.js"), "module.exports = {};");
    mockFs.addFile(repoPath(".git/config"), "[core]");
    mockFs.addFile(repoPath("dist/bundle.js"), "// bundled");

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });

  it("should ignore binary files", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("image.png"), "\u0089PNG\r\n\u001a\n");

    const results = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });

  it("should respect maxFileSize config", () => {
    mockFs.addFile(repoPath("small.ts"), "const x = 1;");
    mockFs.addFile(repoPath("large.ts"), "x".repeat(100));

    const results = scanDirectory(TEST_ROOT, { ...defaultConfig, maxFileSize: 50 });

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("small.ts");
  });

  it("should respect config ignoredPaths", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/generated/output.ts"), "// auto-generated");
    mockFs.addFile(repoPath("docs/readme.md"), "# Docs");

    const results = scanDirectory(TEST_ROOT, {
      ...defaultConfig,
      ignoredPaths: ["src/generated"],
    });

    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.relativePath).sort();
    expect(paths).toEqual(["docs/readme.md", "src/index.ts"]);
  });

  it("should return deterministic ordering", () => {
    mockFs.addFile(repoPath("b.ts"), "// b");
    mockFs.addFile(repoPath("a.ts"), "// a");
    mockFs.addFile(repoPath("c.ts"), "// c");

    const results1 = scanDirectory(TEST_ROOT, defaultConfig);
    const results2 = scanDirectory(TEST_ROOT, defaultConfig);

    expect(results1.map((r) => r.relativePath)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(results1.map((r) => r.relativePath)).toEqual(results2.map((r) => r.relativePath));
  });

  it("should handle empty directories", () => {
    mockFs.addDir(repoPath("src"));
    mockFs.addDir(repoPath("empty"));

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(0);
  });

  it("should handle permission errors gracefully", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/restricted.ts"), "// no access");
    mockFs.statErrors.add(repoPath("src/restricted.ts"));

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should not include symlinks in results", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addSymlink(repoPath("external_link"));

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results).toHaveLength(1);
  });

  it("should handle excludedPaths config", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("src/internal/secret.ts"), "const key = 'secret';");
    mockFs.addFile(repoPath("tests/test.spec.ts"), "describe('test', () => {});");

    const results = scanDirectory(TEST_ROOT, {
      ...defaultConfig,
      excludedPaths: ["src/internal"],
    });
    expect(results).toHaveLength(2);
  });

  it("should handle includedPaths config", () => {
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");
    mockFs.addFile(repoPath("tests/test.spec.ts"), "describe('test', () => {});");
    mockFs.addFile(repoPath("docs/readme.md"), "# Readme");

    const results = scanDirectory(TEST_ROOT, {
      ...defaultConfig,
      includedPaths: ["src"],
    });
    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe("src/index.ts");
  });
});

describe("detectProjectType", () => {
  it("should detect languages from file extensions", () => {
    const files = [makeFile("src/index.ts", "// ts"), makeFile("src/test.py", "# python")];
    const pt = detectProjectType(files);
    expect(pt.languages).toContain("TypeScript");
    expect(pt.languages).toContain("Python");
  });

  it("should detect test dir", () => {
    const pt = detectProjectType([makeFile("tests/test.spec.ts", "")]);
    expect(pt.hasTestDir).toBe(true);
  });
});
