import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { calculateScore, runRules, getResultsBySeverity } from "../engine/rule-runner.js";
import type {
  RuleResult,
  ScanContext,
  RepoProofConfig,
  ScannedFile,
  Rule,
  Category,
} from "../types.js";

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-test-repo");

function makeResult(
  overrides: Partial<RuleResult> & { category: Category; scorePenalty: number },
): RuleResult {
  return {
    id: "test-rule",
    title: "Test Rule",
    description: "Test description",
    severity: "warning",
    category: "incomplete-implementation",
    evidence: [],
    remediation: "Fix it.",
    docUrl: "",
    ...overrides,
  };
}

function makeFile(relativePath: string, content: string): ScannedFile {
  return {
    path: join(TEST_ROOT, relativePath),
    relativePath,
    content,
    size: Buffer.byteLength(content, "utf-8"),
  };
}

const defaultConfig: RepoProofConfig = {
  minScore: 70,
  maxFileSize: 1048576,
  failOn: "error",
};

function makeContext(
  files: ScannedFile[],
  configOverrides?: Partial<RepoProofConfig>,
): ScanContext {
  return {
    files,
    config: { ...defaultConfig, ...configOverrides },
    projectType: {
      languages: [],
      hasPackageJson: false,
      hasTsconfig: false,
      hasPyprojectToml: false,
      hasRequirementsTxt: false,
      hasCargoToml: false,
      hasGoMod: false,
      hasDockerfile: false,
      hasDockerCompose: false,
      hasReadme: true,
      hasLicense: true,
      hasContributing: true,
      hasCodeOfConduct: true,
      hasChangelog: true,
      hasCiWorkflow: true,
      hasGitignore: true,
      hasLockfile: true,
      hasTestDir: false,
      hasEnvExample: true,
      hasEditorConfig: true,
    },
  };
}

function makePassThroughRule(id: string, findings: RuleResult[] = []): Rule {
  return {
    id,
    title: `Rule ${id}`,
    description: `Description for ${id}`,
    severity: "warning",
    category: "incomplete-implementation",
    scorePenalty: 1,
    docUrl: "",
    async run(_ctx: ScanContext) {
      return findings;
    },
  };
}

describe("runRules edge cases", () => {
  it("happy path: multiple rules return all findings in rule order", async () => {
    const rules = [
      makePassThroughRule("rule-a", [
        makeResult({ id: "rule-a", category: "tests", scorePenalty: 2 }),
      ]),
      makePassThroughRule("rule-b", [
        makeResult({ id: "rule-b", category: "tests", scorePenalty: 3 }),
      ]),
    ];
    const ctx = makeContext([makeFile("src/a.ts", "const x = 1;")]);
    const results = await runRules(rules, ctx);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["rule-a", "rule-b"]);
  });

  it("edge: empty rules array returns empty", async () => {
    const ctx = makeContext([makeFile("src/a.ts", "const x = 1;")]);
    const results = await runRules([], ctx);
    expect(results).toEqual([]);
  });

  it("edge: empty repo (no files) with rule returning no matches", async () => {
    const rule = makePassThroughRule("clean-rule", []);
    const ctx = makeContext([]);
    const results = await runRules([rule], ctx);
    expect(results).toHaveLength(0);
  });

  it("edge: malformed/minimal config without optional keys does not crash", async () => {
    const rule = makePassThroughRule("minimal-rule", [
      makeResult({ id: "minimal-rule", category: "tests", scorePenalty: 1 }),
    ]);
    const ctx: ScanContext = {
      files: [makeFile("src/a.ts", "x")],
      config: {},
      projectType: makeContext([]).projectType,
    };
    const results = await runRules([rule], ctx);
    expect(results).toHaveLength(1);
  });

  it("edge: severityOverrides with unknown rule id is ignored", async () => {
    const rule = makePassThroughRule("known-rule", [
      makeResult({ id: "known-rule", category: "tests", scorePenalty: 1, severity: "warning" }),
    ]);
    const ctx = makeContext([makeFile("src/a.ts", "x")], {
      severityOverrides: { "unknown-rule": "error" },
    });
    const results = await runRules([rule], ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
  });

  it("edge: penaltyOverrides with unknown rule id is ignored", async () => {
    const rule = makePassThroughRule("known-rule", [
      makeResult({ id: "known-rule", category: "tests", scorePenalty: 1 }),
    ]);
    const ctx = makeContext([makeFile("src/a.ts", "x")], {
      penaltyOverrides: { "unknown-rule": 99 },
    });
    const results = await runRules([rule], ctx);
    expect(results[0].scorePenalty).toBe(1);
  });

  it("should run more than MAX_CONCURRENCY (4) rules across batches", async () => {
    const rules: Rule[] = Array.from({ length: 7 }, (_, i) =>
      makePassThroughRule(`rule-${i}`, [
        makeResult({
          id: `rule-${i}`,
          category: "incomplete-implementation",
          scorePenalty: 1,
        }),
      ]),
    );
    const ctx = makeContext([makeFile("src/a.ts", "x")]);
    const results = await runRules(rules, ctx);

    expect(results).toHaveLength(7);
    expect(results.map((r) => r.id)).toEqual(Array.from({ length: 7 }, (_, i) => `rule-${i}`));
  });

  it("error handling: sync throw in one rule does not drop other rules findings", async () => {
    const broken: Rule = {
      id: "broken",
      title: "Broken",
      description: "throws",
      severity: "warning",
      category: "tests",
      scorePenalty: 1,
      docUrl: "",
      run(_ctx: ScanContext) {
        throw new Error("sync boom");
      },
    };
    const good = makePassThroughRule("good", [
      makeResult({ id: "good", category: "tests", scorePenalty: 1 }),
    ]);
    const ctx = makeContext([makeFile("src/a.ts", "x")]);
    const results = await runRules([broken, good], ctx);

    expect(results.map((r) => r.id)).toEqual(["good"]);
  });

  it("error handling: async rejection propagates (documents current behavior)", async () => {
    const rejecting: Rule = {
      id: "rejecting",
      title: "Rejecting",
      description: "rejects",
      severity: "warning",
      category: "tests",
      scorePenalty: 1,
      docUrl: "",
      async run(_ctx: ScanContext): Promise<RuleResult[]> {
        return Promise.reject(new Error("async boom"));
      },
    };
    const ctx = makeContext([makeFile("src/a.ts", "x")]);
    await expect(runRules([rejecting], ctx)).rejects.toThrow("async boom");
  });

  it("error handling: async function that throws also rejects", async () => {
    const throwing: Rule = {
      id: "throwing",
      title: "Throwing",
      description: "async throws",
      severity: "warning",
      category: "tests",
      scorePenalty: 1,
      docUrl: "",
      async run(_ctx: ScanContext): Promise<RuleResult[]> {
        throw new Error("async throw");
      },
    };
    const ctx = makeContext([makeFile("src/a.ts", "x")]);
    await expect(runRules([throwing], ctx)).rejects.toThrow("async throw");
  });

  it("should apply overrides to capped findings", async () => {
    const noisy: Rule = {
      id: "noisy",
      title: "Noisy",
      description: "many",
      severity: "warning",
      category: "tests",
      scorePenalty: 1,
      docUrl: "",
      async run(_ctx: ScanContext) {
        return Array.from({ length: 100 }, () =>
          makeResult({ id: "noisy", category: "tests", scorePenalty: 1, severity: "warning" }),
        );
      },
    };
    const ctx = makeContext([makeFile("src/a.ts", "x")], {
      severityOverrides: { noisy: "error" },
      penaltyOverrides: { noisy: 2 },
    });
    const results = await runRules([noisy], ctx);

    expect(results).toHaveLength(50);
    for (const r of results) {
      expect(r.severity).toBe("error");
      expect(r.scorePenalty).toBe(2);
    }
  });
});

describe("calculateScore edge cases", () => {
  it("empty results give perfect score with zero findings per category", () => {
    const { score, categoryScores } = calculateScore([]);
    expect(score).toBe(100);
    for (const cat of Object.keys(categoryScores) as Category[]) {
      expect(categoryScores[cat].findings).toBe(0);
      expect(categoryScores[cat].score).toBe(categoryScores[cat].maxScore);
    }
  });

  it("zero-penalty findings do not reduce score", () => {
    const results = [makeResult({ category: "tests", scorePenalty: 0 })];
    const { score } = calculateScore(results);
    expect(score).toBe(100);
  });
});

describe("getResultsBySeverity edge cases", () => {
  it("mixed severities plus empty input", () => {
    const results = [
      makeResult({ severity: "error", category: "tests", scorePenalty: 1 }),
      makeResult({ severity: "error", category: "tests", scorePenalty: 1 }),
      makeResult({ severity: "info", category: "tests", scorePenalty: 1 }),
    ];
    const grouped = getResultsBySeverity(results);
    expect(grouped.errors).toHaveLength(2);
    expect(grouped.warnings).toHaveLength(0);
    expect(grouped.info).toHaveLength(1);

    const empty = getResultsBySeverity([]);
    expect(empty.errors).toEqual([]);
    expect(empty.warnings).toEqual([]);
    expect(empty.info).toEqual([]);
  });
});
