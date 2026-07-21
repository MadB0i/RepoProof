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
import { calculateGrade } from "../types.js";

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

const defaultConfig: RepoProofConfig = {
  minScore: 70,
  maxFileSize: 1048576,
  failOn: "error",
};

describe("calculateScore", () => {
  it("should start at 100 with no findings", () => {
    const { score } = calculateScore([]);
    expect(score).toBe(100);
  });

  it("should reduce score based on penalties", () => {
    const results = [makeResult({ category: "incomplete-implementation", scorePenalty: 10 })];
    const { score } = calculateScore(results);
    expect(score).toBeLessThan(100);
  });

  it("should cap penalties per category", () => {
    const results = [makeResult({ category: "incomplete-implementation", scorePenalty: 100 })];
    const { score } = calculateScore(results);
    expect(score).toBe(100 - 20);
  });

  it("should calculate grades correctly (A: 90+)", () => {
    const grade = calculateGrade(95);
    expect(grade).toBe("A");
  });

  it("should calculate grades correctly (B: 80+)", () => {
    const grade = calculateGrade(85);
    expect(grade).toBe("B");
  });

  it("should calculate grades correctly (C: 70+)", () => {
    const grade = calculateGrade(75);
    expect(grade).toBe("C");
  });

  it("should calculate grades correctly (D: 60+)", () => {
    const grade = calculateGrade(65);
    expect(grade).toBe("D");
  });

  it("should calculate grades correctly (F: <60)", () => {
    const grade = calculateGrade(59);
    expect(grade).toBe("F");
  });

  it("should calculate category scores independently", () => {
    const results = [
      makeResult({ category: "incomplete-implementation", scorePenalty: 10 }),
      makeResult({ category: "tests", scorePenalty: 15 }),
    ];
    const { categoryScores } = calculateScore(results);

    expect(categoryScores["incomplete-implementation"].score).toBe(10);
    expect(categoryScores["tests"].score).toBe(5);
  });

  it("should be deterministic (same input = same output)", () => {
    const results = [
      makeResult({ category: "incomplete-implementation", scorePenalty: 5 }),
      makeResult({ category: "tests", scorePenalty: 3 }),
    ];

    const r1 = calculateScore(results);
    const r2 = calculateScore(results);

    expect(r1.score).toBe(r2.score);
    expect(r1.categoryScores).toEqual(r2.categoryScores);
  });

  it("should handle score not going below 0", () => {
    const results = [
      makeResult({ category: "incomplete-implementation", scorePenalty: 100 }),
      makeResult({ category: "tests", scorePenalty: 100 }),
      makeResult({ category: "security-configuration", scorePenalty: 100 }),
      makeResult({ category: "error-handling-reliability", scorePenalty: 100 }),
      makeResult({ category: "repository-readiness", scorePenalty: 100 }),
    ];
    const { score } = calculateScore(results);
    expect(score).toBe(0);
  });

  it("should respect custom category limits", () => {
    const results = [makeResult({ category: "incomplete-implementation", scorePenalty: 50 })];
    const { score } = calculateScore(results, { "incomplete-implementation": 5 });
    expect(score).toBe(100 - 5);
  });

  it("should handle multiple findings in same category", () => {
    const results = [
      makeResult({ category: "tests", scorePenalty: 5 }),
      makeResult({ category: "tests", scorePenalty: 5 }),
      makeResult({ category: "tests", scorePenalty: 5 }),
    ];
    const { categoryScores } = calculateScore(results);
    expect(categoryScores["tests"].score).toBe(5);
    expect(categoryScores["tests"].findings).toBe(3);
  });

  it("should report maxScore correctly for each category", () => {
    const results = [makeResult({ category: "security-configuration", scorePenalty: 10 })];
    const { categoryScores } = calculateScore(results);

    expect(categoryScores["security-configuration"].maxScore).toBe(30);
    expect(categoryScores["security-configuration"].score).toBe(20);
  });
});

describe("getResultsBySeverity", () => {
  it("should group results by severity", () => {
    const results = [
      makeResult({ severity: "error", category: "incomplete-implementation", scorePenalty: 5 }),
      makeResult({ severity: "warning", category: "incomplete-implementation", scorePenalty: 5 }),
      makeResult({ severity: "info", category: "incomplete-implementation", scorePenalty: 5 }),
    ];
    const grouped = getResultsBySeverity(results);

    expect(grouped.errors).toHaveLength(1);
    expect(grouped.warnings).toHaveLength(1);
    expect(grouped.info).toHaveLength(1);
  });

  it("should return empty arrays for missing severities", () => {
    const grouped = getResultsBySeverity([]);
    expect(grouped.errors).toHaveLength(0);
    expect(grouped.warnings).toHaveLength(0);
    expect(grouped.info).toHaveLength(0);
  });
});

describe("runRules", () => {
  const makeScannedFile = (relativePath: string, content: string): ScannedFile => ({
    path: join(TEST_ROOT, relativePath),
    relativePath,
    content,
    size: Buffer.byteLength(content, "utf-8"),
  });

  const makeContext = (
    files: ScannedFile[],
    configOverrides?: Partial<RepoProofConfig>,
  ): ScanContext => ({
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
  });

  it("should run rules and return results", async () => {
    const rule: Rule = {
      id: "test-rule",
      title: "Test Rule",
      description: "A test rule",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
      docUrl: "",
      async run(_ctx: ScanContext) {
        return [makeResult({ category: "incomplete-implementation", scorePenalty: 5 })];
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "// TODO: test")]);
    const results = await runRules([rule], ctx);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test-rule");
  });

  it("should apply severity overrides", async () => {
    const rule: Rule = {
      id: "test-rule",
      title: "Test Rule",
      description: "A test rule",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
      docUrl: "",
      async run(_ctx: ScanContext) {
        return [
          makeResult({ id: "test-rule", category: "incomplete-implementation", scorePenalty: 5 }),
        ];
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "x")], {
      severityOverrides: { "test-rule": "error" },
    });
    const results = await runRules([rule], ctx);

    expect(results[0].severity).toBe("error");
  });

  it("should apply penalty overrides", async () => {
    const rule: Rule = {
      id: "test-rule",
      title: "Test Rule",
      description: "A test rule",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
      docUrl: "",
      async run(_ctx: ScanContext) {
        return [
          makeResult({ id: "test-rule", category: "incomplete-implementation", scorePenalty: 5 }),
        ];
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "x")], {
      penaltyOverrides: { "test-rule": 10 },
    });
    const results = await runRules([rule], ctx);

    expect(results[0].scorePenalty).toBe(10);
  });

  it("should skip disabled rules", async () => {
    let called = false;
    const rule: Rule = {
      id: "disabled-rule",
      title: "Disabled",
      description: "Should not run",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
      docUrl: "",
      async run(_ctx: ScanContext) {
        called = true;
        return [
          makeResult({
            id: "disabled-rule",
            category: "incomplete-implementation",
            scorePenalty: 5,
          }),
        ];
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "x")], {
      disabledRules: ["disabled-rule"],
    });
    const results = await runRules([rule], ctx);

    expect(results).toHaveLength(0);
    expect(called).toBe(false);
  });

  it("should cap findings per rule at 50", async () => {
    const rule: Rule = {
      id: "noisy-rule",
      title: "Noisy",
      description: "Produces many findings",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 1,
      docUrl: "",
      async run(_ctx: ScanContext) {
        const results: RuleResult[] = [];
        for (let i = 0; i < 100; i++) {
          results.push(
            makeResult({
              id: "noisy-rule",
              category: "incomplete-implementation",
              scorePenalty: 1,
            }),
          );
        }
        return results;
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "x")]);
    const results = await runRules([rule], ctx);

    expect(results).toHaveLength(50);
  });

  it("should handle synchronous errors in rule execution gracefully", async () => {
    const rule: Rule = {
      id: "broken-rule",
      title: "Broken",
      description: "Throws error",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
      docUrl: "",
      run(_ctx: ScanContext) {
        throw new Error("Something broke");
      },
    };

    const ctx = makeContext([makeScannedFile("src/file.ts", "x")]);
    const results = await runRules([rule], ctx);

    expect(results).toHaveLength(0);
  });
});
