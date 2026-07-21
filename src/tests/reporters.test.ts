import { describe, it, expect } from "vitest";
import { generateTextReport } from "../reporters/text-reporter.js";
import { generateJsonReport } from "../reporters/json-reporter.js";
import { generateMarkdownReport } from "../reporters/markdown-reporter.js";
import { generateSarifReport } from "../reporters/sarif-reporter.js";
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
    category: "incomplete-implementation",
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
      "incomplete-implementation": { score: 15, maxScore: 20, findings: 1 },
      tests: { score: 20, maxScore: 20, findings: 0 },
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

describe("Text reporter", () => {
  it("should produce output with score and grade", () => {
    const report = makeReport();
    const output = generateTextReport(report, { noColor: true });

    expect(output).toContain("85.0/100");
    expect(output).toContain("B");
  });

  it("should show findings when present", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO: fix" }],
    });
    const report = makeReport({
      score: 75,
      grade: "C",
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
      categoryScores: {
        "incomplete-implementation": { score: 15, maxScore: 20, findings: 1 },
        tests: { score: 20, maxScore: 20, findings: 0 },
        "security-configuration": { score: 30, maxScore: 30, findings: 0 },
        "error-handling-reliability": { score: 15, maxScore: 15, findings: 0 },
        "repository-readiness": { score: 15, maxScore: 15, findings: 0 },
      },
    });

    const output = generateTextReport(report, { noColor: true });

    expect(output).toContain("WARNING");
    expect(output).toContain("todo-fixme");
    expect(output).toContain("src/index.ts:5");
  });

  it("should handle empty findings", () => {
    const report = makeReport();
    const output = generateTextReport(report, { noColor: true });

    expect(output).toContain("No findings");
  });

  it("should support quiet mode", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          severity: "warning",
          category: "incomplete-implementation",
          scorePenalty: 5,
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateTextReport(report, { noColor: true, quiet: true });

    expect(output).toContain("85.0/100 (B)");
    expect(output).not.toContain("Summary");
    expect(output).not.toContain("Category Breakdown");
  });

  it("should support verbose mode with evidence snippets", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO: implement this function" }],
      description: "Found TODO markers",
      remediation: "Remove TODO markers",
      docUrl: "https://repoproof.dev/docs/rules/todo-fixme",
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateTextReport(report, { noColor: true, verbose: true });

    expect(output).toContain("TODO: implement this function");
    expect(output).toContain("Remediation:");
    expect(output).toContain("Docs:");
  });
});

describe("JSON reporter", () => {
  it("should produce valid JSON with correct schema", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO" }],
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateJsonReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.$schema).toBeDefined();
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.score).toBe(85);
    expect(parsed.grade).toBe("B");
    expect(parsed.maxScore).toBe(100);
    expect(parsed.projectType).toBeDefined();
    expect(parsed.categoryScores).toBeDefined();
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.summary.totalFindings).toBe(1);
    expect(parsed.summary.errors).toBe(0);
    expect(parsed.summary.warnings).toBe(1);
  });

  it("should handle empty findings", () => {
    const report = makeReport();
    const output = generateJsonReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.findings).toHaveLength(0);
    expect(parsed.summary.totalFindings).toBe(0);
  });

  it("should produce pretty-printed JSON", () => {
    const report = makeReport();
    const output = generateJsonReport(report);

    expect(output).toContain("\n");
    expect(output).toContain("  ");
  });

  it("should include all category scores", () => {
    const report = makeReport();
    const output = generateJsonReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.categoryScores["incomplete-implementation"]).toBeDefined();
    expect(parsed.categoryScores["tests"]).toBeDefined();
    expect(parsed.categoryScores["security-configuration"]).toBeDefined();
    expect(parsed.categoryScores["error-handling-reliability"]).toBeDefined();
    expect(parsed.categoryScores["repository-readiness"]).toBeDefined();
  });
});

describe("Markdown reporter", () => {
  it("should produce markdown with findings", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO: fix" }],
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateMarkdownReport(report);

    expect(output).toContain("# RepoProof Quality Audit");
    expect(output).toContain("Score");
    expect(output).toContain("Grade");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Category Breakdown");
    expect(output).toContain("todo-fixme");
  });

  it("should handle empty findings", () => {
    const report = makeReport();
    const output = generateMarkdownReport(report);

    expect(output).toContain("No findings detected");
  });

  it("should include evidence snippets", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO: fix this" }],
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateMarkdownReport(report);

    expect(output).toContain("```");
    expect(output).toContain("// TODO: fix this");
  });

  it("should include remediation text", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      evidence: [{ file: "src/index.ts", line: 5 }],
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateMarkdownReport(report);

    expect(output).toContain("**Remediation:**");
  });
});

describe("SARIF reporter", () => {
  it("should produce valid SARIF structure", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      title: "TODO/FIXME markers",
      description: "Found TODO markers",
      evidence: [{ file: "src/index.ts", line: 5, snippet: "// TODO" }],
      remediation: "Remove TODO markers",
      docUrl: "https://repoproof.dev/docs/rules/todo-fixme",
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateSarifReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.$schema).toBeDefined();
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);

    const run = parsed.runs[0];
    expect(run.tool.driver.name).toBe("RepoProof");
    expect(run.tool.driver.rules).toBeDefined();
    expect(run.results).toHaveLength(1);
    expect(run.results[0].ruleId).toBe("todo-fixme");
    expect(run.results[0].level).toBe("warning");
  });

  it("should map severity correctly", () => {
    const findings = [
      makeFinding({
        id: "rule-1",
        severity: "error",
        category: "security-configuration",
        scorePenalty: 10,
      }),
      makeFinding({
        id: "rule-2",
        severity: "info",
        category: "repository-readiness",
        scorePenalty: 1,
      }),
    ];
    const report = makeReport({
      findings,
      summary: { totalFindings: 2, errors: 1, warnings: 0, info: 1, passedChecks: 32 },
    });

    const output = generateSarifReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].results[0].level).toBe("error");
    expect(parsed.runs[0].results[1].level).toBe("note");
  });

  it("should handle empty findings", () => {
    const report = makeReport();
    const output = generateSarifReport(report);
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].results).toHaveLength(0);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
  });

  it("should accept repoUri and commitSha options", () => {
    const report = makeReport();
    const output = generateSarifReport(report, {
      repoUri: "https://github.com/user/repo",
      commitSha: "abc123",
    });
    const parsed = JSON.parse(output);

    const vcp = parsed.runs[0].versionControlProvenance;
    expect(vcp).toBeDefined();
    expect(vcp[0].repositoryUri).toBe("https://github.com/user/repo");
    expect(vcp[0].revisionId).toBe("abc123");
  });

  it("should include properties on results", () => {
    const finding = makeFinding({
      id: "todo-fixme",
      severity: "warning",
      category: "incomplete-implementation",
      scorePenalty: 5,
    });
    const report = makeReport({
      findings: [finding],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });

    const output = generateSarifReport(report);
    const parsed = JSON.parse(output);

    const result = parsed.runs[0].results[0];
    expect(result.properties.category).toBe("incomplete-implementation");
    expect(result.properties.scorePenalty).toBe(5);
  });
});

describe("All reporters - empty findings handling", () => {
  it("text reporter handles empty findings", () => {
    const report = makeReport();
    const output = generateTextReport(report, { noColor: true });
    expect(output).toContain("No findings");
  });

  it("JSON reporter handles empty findings", () => {
    const report = makeReport();
    const output = generateJsonReport(report);
    const parsed = JSON.parse(output);
    expect(parsed.findings).toHaveLength(0);
  });

  it("markdown reporter handles empty findings", () => {
    const report = makeReport();
    const output = generateMarkdownReport(report);
    expect(output).toContain("No findings detected");
  });

  it("SARIF reporter handles empty findings", () => {
    const report = makeReport();
    const output = generateSarifReport(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results).toHaveLength(0);
  });
});
