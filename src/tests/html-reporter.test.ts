import { describe, it, expect } from "vitest";
import { generateHtmlReport } from "../reporters/html-reporter.js";
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
    scorePenalty: 5,
    docUrl: "https://repoproof.dev/docs/rules/test-rule",
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

describe("HTML reporter", () => {
  it("should produce a self-contained single-file document", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain("<!DOCTYPE html>");
    expect(output).toContain("</html>");
    expect(output).toContain("<style>");
    expect(output).toContain("<script>");
    expect(output).not.toContain('rel="stylesheet"');
    expect(output).not.toContain("<script src=");
  });

  it("should default to dark mode and persist toggles safely", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain('data-theme="dark"');
    expect(output).toContain('getItem("repoproof-theme")');
    expect(output).toContain('setItem("repoproof-theme"');
    expect(output).toContain("try { storage = window.localStorage; }");
    expect(output).toContain('aria-pressed="true"');
  });

  it("should make the scanned target the primary heading and keep RepoProof as chrome", () => {
    const output = generateHtmlReport(makeReport(), {
      targetLabel: "D:\\Projects\\WireSong",
      targetKind: "local",
    });

    expect(output).toContain("<title>D:\\Projects\\WireSong — RepoProof Audit</title>");
    expect(output).toContain('<div class="wordmark">RepoProof</div>');
    expect(output).toContain("<h1>WireSong</h1>");
    expect(output).toContain("<strong>SCAN</strong> 2026-01-01T00:00:00.000Z");
    expect(output).not.toContain("<h1>RepoProof");
  });

  it("should keep owner/repo as the primary heading for GitHub scans", () => {
    const output = generateHtmlReport(makeReport(), {
      targetLabel: "MadB0i/C.U.R.E",
      targetKind: "github",
    });

    expect(output).toContain("<title>MadB0i/C.U.R.E — RepoProof Audit</title>");
    expect(output).toContain("<h1>MadB0i/C.U.R.E</h1>");
  });

  it("should emit valid selector quoting for the initial sort", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain("document.querySelector('th[data-sort=\"severity\"]')");
    expect(output).not.toContain('document.querySelector("th[data-sort="severity"]")');
  });

  it("should use diagnostic-console tokens and one gauge sweep", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain("--color-bg: #14161C");
    expect(output).toContain("--color-accent: #00D9C0");
    expect(output).toContain('"Space Grotesk"');
    expect(output).toContain('"IBM Plex Mono"');
    expect(output).toContain("@keyframes gaugeSweep");
    expect(output).toContain("animation: gaugeSweep 0.8s ease-out both");
  });

  it("should render empty state when no findings", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain("All Checks Passed");
    expect(output).not.toContain('id="findingsBody"');
  });

  it("should render score gauge, grade, and summary counts", () => {
    const report = makeReport({
      findings: [
        makeFinding({ severity: "error", category: "security-configuration", scorePenalty: 10 }),
      ],
      summary: { totalFindings: 1, errors: 1, warnings: 0, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("85.0");
    expect(output).toContain(">B<");
    expect(output).toContain('id="countError">1<');
    expect(output).toContain("score-ring");
  });

  it("should render severity badges and findings table with location", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          id: "todo-fixme",
          severity: "warning",
          title: "TODO markers",
          category: "incomplete-implementation",
          evidence: [{ file: "src/index.ts", line: 5 }],
          remediation: "Remove TODO markers",
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain('class="severity-badge warning"');
    expect(output).toContain("todo-fixme");
    expect(output).toContain("src/index.ts:5");
    expect(output).toContain("Remove TODO markers");
    expect(output).toContain("Incomplete Implementation");
  });

  it("should render N/A location for findings without evidence", () => {
    const report = makeReport({
      findings: [makeFinding({ evidence: [] })],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("N/A");
  });

  it("should escape HTML in titles, descriptions, and snippets", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          title: '<script>alert("x")</script>',
          description: "desc with <b>html</b> & quotes",
          evidence: [{ file: "a.ts", line: 1, snippet: "<img src=x onerror=alert(1)>" }],
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).not.toContain('<script>alert("x")</script>');
    expect(output).toContain("&lt;script&gt;");
    expect(output).toContain("&lt;b&gt;html&lt;/b&gt;");
    expect(output).toContain("&amp;");
    expect(output).toContain("&lt;img src=x");
  });

  it("should redact secrets in evidence snippets", () => {
    const secret = "thisisalongsecretvalue123";
    const report = makeReport({
      findings: [
        makeFinding({
          evidence: [{ file: "src/config.ts", line: 1, snippet: `const x = "${secret}";` }],
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain(secret);
  });

  it("should include sortable/filterable table controls", () => {
    const report = makeReport({
      findings: [makeFinding({ evidence: [{ file: "a.ts", line: 1 }] })],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain('id="categoryFilter"');
    expect(output).toContain('id="searchFilter"');
    expect(output).toContain("severity-filter");
    expect(output).toContain('data-sort="severity"');
    expect(output).toContain('data-sort="location"');
  });

  it("should render doc link when docUrl is present", () => {
    const report = makeReport({
      findings: [
        makeFinding({
          docUrl: "https://repoproof.dev/docs/rules/test-rule",
          evidence: [{ file: "a.ts", line: 1 }],
        }),
      ],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("https://repoproof.dev/docs/rules/test-rule");
  });

  it("should render category cards for all categories", () => {
    const output = generateHtmlReport(
      makeReport({
        findings: [makeFinding({ evidence: [{ file: "a.ts", line: 1 }] })],
        summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
      }),
    );

    expect(output).toContain("Incomplete Implementation");
    expect(output).toContain("Security Configuration");
    expect(output).toContain("Repository Readiness");
  });

  it("should include report version and timestamp in footer", () => {
    const output = generateHtmlReport(makeReport());

    expect(output).toContain("RepoProof v1.0.0");
    expect(output).toContain("2026-01-01T00:00:00.000Z");
  });

  it("should use warn score color for mid-range scores", () => {
    const report = makeReport({
      score: 70,
      grade: "C",
      findings: [makeFinding({ evidence: [{ file: "a.ts", line: 1 }] })],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("70.0");
    expect(output).toContain("--color-warn");
  });

  it("should use fail score color for low scores", () => {
    const report = makeReport({
      score: 40,
      grade: "F",
      findings: [makeFinding({ evidence: [{ file: "a.ts", line: 1 }] })],
      summary: { totalFindings: 1, errors: 0, warnings: 1, info: 0, passedChecks: 33 },
    });
    const output = generateHtmlReport(report);

    expect(output).toContain("40.0");
    expect(output).toContain("--color-fail");
  });
});
