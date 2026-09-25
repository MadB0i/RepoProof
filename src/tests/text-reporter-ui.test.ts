import { describe, it, expect } from "vitest";
import {
  generateTextReport,
  oneLineRemediation,
  formatScoreDelta,
} from "../reporters/text-reporter.js";
import { shouldShowProgress, formatProgressMessage } from "../cli/progress.js";
import type { ScanReport, RuleResult, RepoProofConfig, ProjectType } from "../types.js";

const defaultProjectType: ProjectType = {
  languages: ["TypeScript"],
  hasPackageJson: true,
  hasTsconfig: true,
  hasPyprojectToml: false,
  hasRequirementsTxt: false,
  hasCargoToml: false,
  hasGoMod: false,
  hasDockerfile: false,
  hasDockerCompose: false,
  hasReadme: true,
  hasLicense: true,
  hasContributing: false,
  hasCodeOfConduct: false,
  hasChangelog: false,
  hasCiWorkflow: true,
  hasGitignore: true,
  hasLockfile: true,
  hasTestDir: true,
  hasEnvExample: false,
  hasEditorConfig: false,
};

const defaultConfig: RepoProofConfig = { minScore: 70, maxFileSize: 1048576, failOn: "error" };

function makeFinding(overrides: Partial<RuleResult>): RuleResult {
  return {
    id: "test-rule",
    title: "Test Rule",
    description: "A test finding description",
    severity: "warning",
    category: "tests",
    evidence: [],
    remediation: "Fix the issue.",
    docUrl: "https://repoproof.dev/docs/rules/test-rule",
    scorePenalty: 5,
    ...overrides,
  };
}

function makeReport(overrides?: Partial<ScanReport>): ScanReport {
  return {
    version: "1.0.0",
    timestamp: "2026-01-01T00:00:00.000Z",
    score: 85,
    grade: "B",
    maxScore: 100,
    projectType: defaultProjectType,
    categoryScores: {
      "incomplete-implementation": { score: 20, maxScore: 20, findings: 0 },
      tests: { score: 15, maxScore: 20, findings: 1 },
      "security-configuration": { score: 30, maxScore: 30, findings: 0 },
      "error-handling-reliability": { score: 15, maxScore: 15, findings: 0 },
      "repository-readiness": { score: 15, maxScore: 15, findings: 0 },
    },
    findings: [],
    config: defaultConfig,
    summary: { totalFindings: 0, errors: 0, warnings: 0, info: 0, passedChecks: 34 },
    ...overrides,
  };
}

describe("Text reporter UI: hero score", () => {
  it("should show a prominent hero line with score and grade", () => {
    const output = generateTextReport(makeReport(), { noColor: true });

    expect(output).toContain("85.0/100");
    expect(output).toContain("Grade B");
  });

  it("should color score and grade when color is enabled", () => {
    const output = generateTextReport(makeReport());

    // ANSI color codes present (green for B / 85)
    expect(output).toContain("\x1B[");
  });
});

describe("Text reporter UI: category grouping", () => {
  it("should group findings under category subheaders", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          id: "rule-a",
          severity: "warning",
          category: "tests",
          evidence: [{ file: "a.ts", line: 1 }],
        }),
        makeFinding({
          id: "rule-b",
          severity: "warning",
          category: "tests",
          evidence: [{ file: "b.ts", line: 2 }],
        }),
      ],
      summary: { totalFindings: 2, errors: 0, warnings: 2, info: 0, passedChecks: 32 },
    });
    const output = generateTextReport(report, { noColor: true });

    expect(output).toContain("Tests (2)");
    expect(output).toContain("rule-a");
    expect(output).toContain("rule-b");
  });

  it("should show one-line remediation without verbose mode", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          remediation: "Add the missing timeout option.",
          evidence: [{ file: "a.ts", line: 1 }],
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateTextReport(report, { noColor: true });

    expect(output).toContain("Fix: Add the missing timeout option.");
    expect(output).toContain("a.ts:1");
  });
});

describe("Text reporter UI: baseline delta footer", () => {
  function reportWithFinding(): ScanReport {
    return makeReport({
      findings: [makeFinding({ evidence: [{ file: "a.ts", line: 1 }] })],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
  }

  it("should show positive delta when score improved", () => {
    const output = generateTextReport(reportWithFinding(), {
      noColor: true,
      baselineScore: 70,
    });

    expect(output).toContain("Score change vs baseline (70.0): +15.0");
  });

  it("should show negative delta when score regressed", () => {
    const output = generateTextReport(reportWithFinding(), {
      noColor: true,
      baselineScore: 95,
    });

    expect(output).toContain("Score change vs baseline (95.0):");
    expect(output).toContain("10.0");
  });

  it("should omit delta line when no baseline is given", () => {
    const output = generateTextReport(reportWithFinding(), { noColor: true });

    expect(output).not.toContain("Score change vs baseline");
  });

  it("should omit delta line in quiet mode footer", () => {
    const output = generateTextReport(reportWithFinding(), { noColor: true, quiet: true });

    expect(output).not.toContain("Score change vs baseline");
  });
});

describe("oneLineRemediation", () => {
  it("should return the first line only", () => {
    expect(oneLineRemediation("Line one.\nLine two.")).toBe("Line one.");
  });

  it("should truncate long remediation with ellipsis", () => {
    const long = "x".repeat(200);
    const result = oneLineRemediation(long, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toContain("…");
  });

  it("should return short text unchanged", () => {
    expect(oneLineRemediation("Fix it.")).toBe("Fix it.");
  });
});

describe("formatScoreDelta", () => {
  it("should format positive, negative, and zero deltas", () => {
    expect(formatScoreDelta(85, 70)).toBe("+15.0");
    expect(formatScoreDelta(70, 85)).toContain("15.0");
    expect(formatScoreDelta(70, 85).startsWith("+")).toBe(false);
    expect(formatScoreDelta(85, 85)).toBe("0.0");
  });
});

describe("CLI progress helpers", () => {
  it("should format progress message with file and rule counts", () => {
    expect(formatProgressMessage(142, 31)).toBe("Scanning... 142 file(s), 31 rule(s)");
  });

  it("should auto-show for interactive text scans", () => {
    expect(shouldShowProgress({ format: "text", quiet: false }, true)).toBe(true);
  });

  it("should hide for non-TTY, quiet, or non-text formats", () => {
    expect(shouldShowProgress({ format: "text", quiet: false }, false)).toBe(false);
    expect(shouldShowProgress({ format: "text", quiet: true }, true)).toBe(false);
    expect(shouldShowProgress({ format: "json", quiet: false }, true)).toBe(false);
  });

  it("should force-show with explicit --progress", () => {
    expect(shouldShowProgress({ format: "json", quiet: true, progress: true }, false)).toBe(true);
  });
});
