import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join, relative, dirname } from "node:path";
import { Command } from "commander";
import {
  readHistory,
  appendHistory,
  resolveBaseline,
  historyFilePath,
  MAX_HISTORY_ENTRIES,
  type HistoryEntry,
} from "../history/history.js";

interface MockStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
}

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-history-repo");
const repoPath = (...segments: string[]) => normalizeMockPath(join(TEST_ROOT, ...segments));

const mockFs = {
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  stats: new Map<string, MockStat>(),
  readErrors: new Set<string>(),
  writeErrors: new Set<string>(),

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.readErrors.clear();
    this.writeErrors.clear();
    this.dirs.add(TEST_ROOT);
    this.stats.set(TEST_ROOT, {
      isFile: false,
      isDirectory: true,
      isSymbolicLink: false,
      size: 0,
    });
  },

  ensureParentDirs(normalizedFilePath: string) {
    let dir = dirname(normalizedFilePath).replace(/\\/g, "/");
    const chain: string[] = [];
    while (dir !== TEST_ROOT && !this.dirs.has(dir)) {
      chain.unshift(dir);
      const parent = dirname(dir).replace(/\\/g, "/");
      if (parent === dir) break;
      dir = parent;
    }
    for (const d of chain) {
      this.dirs.add(d);
      this.stats.set(d, { isFile: false, isDirectory: true, isSymbolicLink: false, size: 0 });
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
    writeFileSync: vi.fn((path: string, content: string) => {
      const n = normalizeMockPath(path);
      if (mockFs.writeErrors.has(n)) throw new Error(`EACCES: write denied ${n}`);
      mockFs.ensureParentDirs(n);
      mockFs.files.set(n, content);
      mockFs.stats.set(n, {
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: Buffer.byteLength(content),
      });
    }),
    mkdirSync: vi.fn((path: string) => {
      const n = normalizeMockPath(path);
      mockFs.ensureParentDirs(n + "/x");
      mockFs.dirs.add(n);
      mockFs.stats.set(n, { isFile: false, isDirectory: true, isSymbolicLink: false, size: 0 });
      return undefined;
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
      return mockFs.files.has(n) || mockFs.dirs.has(n);
    }),
  };
});

import { scanDirectory } from "../engine/scanner.js";
import type { RepoProofConfig } from "../types.js";

const defaultConfig: RepoProofConfig = { minScore: 70, maxFileSize: 1048576, failOn: "error" };

function makeEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    score: 80,
    grade: "B",
    findingsCount: 5,
    ...overrides,
  };
}

beforeEach(() => {
  mockFs.reset();
});

describe("readHistory", () => {
  it("should return [] when history file is absent", () => {
    expect(readHistory(TEST_ROOT)).toEqual([]);
  });

  it("should return [] for corrupt JSON instead of throwing", () => {
    mockFs.addFile(repoPath(".repoproof/history.json"), "not-json{{{");
    expect(readHistory(TEST_ROOT)).toEqual([]);
  });

  it("should return [] for non-array JSON", () => {
    mockFs.addFile(repoPath(".repoproof/history.json"), '{"score": 80}');
    expect(readHistory(TEST_ROOT)).toEqual([]);
  });

  it("should filter out malformed entries and keep valid ones", () => {
    mockFs.addFile(
      repoPath(".repoproof/history.json"),
      JSON.stringify([
        makeEntry({ score: 80 }),
        { score: "high", grade: "B" },
        { timestamp: "x", score: Number.NaN, grade: "F", findingsCount: 1 },
        null,
        makeEntry({ score: 90 }),
      ]),
    );
    const entries = readHistory(TEST_ROOT);
    expect(entries.map((e) => e.score)).toEqual([80, 90]);
  });

  it("should return [] when file is unreadable instead of throwing", () => {
    mockFs.addFile(repoPath(".repoproof/history.json"), "[]");
    mockFs.readErrors.add(repoPath(".repoproof/history.json"));
    expect(readHistory(TEST_ROOT)).toEqual([]);
  });
});

describe("appendHistory", () => {
  it("should create dir + file and append entries in order", () => {
    appendHistory(TEST_ROOT, makeEntry({ score: 80 }));
    appendHistory(TEST_ROOT, makeEntry({ score: 85 }));

    const entries = readHistory(TEST_ROOT);
    expect(entries.map((e) => e.score)).toEqual([80, 85]);
  });

  it("should trim to the last MAX_HISTORY_ENTRIES runs", () => {
    expect(MAX_HISTORY_ENTRIES).toBe(50);
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      appendHistory(TEST_ROOT, makeEntry({ score: i }));
    }

    const entries = readHistory(TEST_ROOT);
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(entries[0].score).toBe(5);
    expect(entries[entries.length - 1].score).toBe(MAX_HISTORY_ENTRIES + 4);
  });

  it("should never throw when the write fails", () => {
    mockFs.writeErrors.add(historyFilePath(TEST_ROOT));
    expect(() => appendHistory(TEST_ROOT, makeEntry())).not.toThrow();
  });

  it("should store timestamp, score, grade, and findingsCount", () => {
    appendHistory(
      TEST_ROOT,
      makeEntry({
        timestamp: "2026-02-02T00:00:00.000Z",
        score: 73,
        grade: "C",
        findingsCount: 11,
      }),
    );
    const [entry] = readHistory(TEST_ROOT);
    expect(entry).toEqual({
      timestamp: "2026-02-02T00:00:00.000Z",
      score: 73,
      grade: "C",
      findingsCount: 11,
    });
  });
});

describe("resolveBaseline priority", () => {
  const history = [makeEntry({ score: 80 }), makeEntry({ score: 85 })];

  it("explicit flag wins over history (current behavior untouched)", () => {
    expect(resolveBaseline("70", history)).toBe(70);
  });

  it("falls back to the most recent history score", () => {
    expect(resolveBaseline(undefined, history)).toBe(85);
  });

  it("empty-string flag falls back to history (same as flag absent)", () => {
    expect(resolveBaseline("", history)).toBe(85);
  });

  it("returns undefined when both are absent (current no-baseline behavior)", () => {
    expect(resolveBaseline(undefined, [])).toBeUndefined();
    expect(resolveBaseline("", [])).toBeUndefined();
  });

  it("garbage flag yields NaN, which the reporter skips as absent", () => {
    const baseline = resolveBaseline("not-a-number", history);
    expect(baseline !== undefined && Number.isNaN(baseline)).toBe(true);
  });
});

describe("CLI --no-history flag", () => {
  // Commander negation: `--no-history` yields `history === false`
  // (same pattern as the existing `--no-color` → `color === false`).
  it("should parse --no-history as history === false", async () => {
    const program = new Command();
    program.exitOverride();
    let captured: boolean | undefined;
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--no-history", "Skip history")
      .action((_path: string, opts: { history?: boolean }) => {
        captured = opts.history;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--no-history"]);
    expect(captured).toBe(false);
  });

  it("should default to history enabled", async () => {
    const program = new Command();
    program.exitOverride();
    let captured: boolean | undefined;
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--no-history", "Skip history")
      .action((_path: string, opts: { history?: boolean }) => {
        captured = opts.history;
      });

    await program.parseAsync(["node", "repoproof", "scan"]);
    expect(captured).not.toBe(false);
  });
});

describe("history file is never scanned", () => {
  it(".repoproof/history.json does not appear in scan results", () => {
    mockFs.addFile(repoPath(".repoproof/history.json"), JSON.stringify([makeEntry()]));
    mockFs.addFile(repoPath("src/index.ts"), "const x = 1;");

    const results = scanDirectory(TEST_ROOT, defaultConfig);
    expect(results.map((r) => r.relativePath)).toEqual(["src/index.ts"]);
  });
});

describe("history file path helpers", () => {
  it("should resolve history.json under .repoproof of the scan root", () => {
    const rel = relative(TEST_ROOT, historyFilePath(TEST_ROOT)).replace(/\\/g, "/");
    expect(rel).toBe(".repoproof/history.json");
  });
});
