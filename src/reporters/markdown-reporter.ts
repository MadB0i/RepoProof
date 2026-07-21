import { ScanReport, Category } from "../types.js";
import { getResultsBySeverity } from "../engine/rule-runner.js";
import { redactSnippet } from "../engine/redact.js";

const CATEGORY_LABELS: Record<Category, string> = {
  "incomplete-implementation": "Incomplete Implementation",
  tests: "Tests",
  "security-configuration": "Security Configuration",
  "error-handling-reliability": "Error Handling & Reliability",
  "repository-readiness": "Repository Readiness",
};

const SEVERITY_LABELS: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

function severityBadge(severity: string): string {
  const color = severity === "error" ? "red" : severity === "warning" ? "yellow" : "blue";
  return `![${severity}](https://img.shields.io/badge/-${severity.toUpperCase()}-${color})`;
}

export function generateMarkdownReport(report: ScanReport): string {
  const { errors, warnings, info } = getResultsBySeverity(report.findings);
  const lines: string[] = [];

  // Header
  lines.push(`# RepoProof Quality Audit`);
  lines.push("");

  // Badge placeholder
  const badgeColor =
    report.grade === "A"
      ? "brightgreen"
      : report.grade === "B"
        ? "green"
        : report.grade === "C"
          ? "yellow"
          : report.grade === "D"
            ? "orange"
            : "red";
  lines.push(
    `[![Score: ${report.score.toFixed(1)}](https://img.shields.io/badge/Score-${report.score.toFixed(1)}%2F100-${badgeColor})]()` +
      ` [![Grade: ${report.grade}](https://img.shields.io/badge/Grade-${report.grade}-${badgeColor})]()`,
  );
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| **Score** | ${report.score.toFixed(1)} / ${report.maxScore} |`);
  lines.push(`| **Grade** | ${report.grade} |`);
  lines.push(`| **Total Findings** | ${report.summary.totalFindings} |`);
  lines.push(`| **Errors** | ${errors.length} |`);
  lines.push(`| **Warnings** | ${warnings.length} |`);
  lines.push(`| **Info** | ${info.length} |`);
  lines.push(`| **Passed Checks** | ${report.summary.passedChecks} |`);
  lines.push(`| **Generated** | ${report.timestamp} |`);
  lines.push(`| **RepoProof Version** | ${report.version} |`);
  lines.push("");

  // Project type
  if (report.projectType) {
    const langs = report.projectType.languages;
    if (langs.length > 0) {
      lines.push(`**Languages:** ${langs.join(", ")}`);
      lines.push("");
    }
  }

  // Category breakdown
  lines.push("## Category Breakdown");
  lines.push("");
  lines.push("| Category | Score | Max | Findings | Status |");
  lines.push("|----------|-------|-----|----------|--------|");

  const categories = Object.keys(report.categoryScores) as Category[];
  for (const cat of categories) {
    const cs = report.categoryScores[cat];
    const label = CATEGORY_LABELS[cat] ?? cat;
    const pct = cs.maxScore > 0 ? (cs.score / cs.maxScore) * 100 : 0;
    const bar = progressBar(pct, 10);
    lines.push(`| ${label} | ${cs.score.toFixed(1)} | ${cs.maxScore} | ${cs.findings} | ${bar} |`);
  }
  lines.push("");

  // Findings grouped by severity
  if (report.findings.length === 0) {
    lines.push("## Findings");
    lines.push("");
    lines.push("No findings detected. All checks passed.");
    lines.push("");
    return lines.join("\n");
  }

  const severityOrder: Array<{ key: string; label: string; items: typeof report.findings }> = [
    { key: "error", label: "Errors", items: errors },
    { key: "warning", label: "Warnings", items: warnings },
    { key: "info", label: "Info", items: info },
  ];

  for (const group of severityOrder) {
    if (group.items.length === 0) continue;

    lines.push(`## ${group.label} (${group.items.length})`);
    lines.push("");

    for (let i = 0; i < group.items.length; i++) {
      const f = group.items[i];
      const firstEvidence = f.evidence[0];
      const location = firstEvidence
        ? `${firstEvidence.file}${firstEvidence.line != null ? `:${firstEvidence.line}` : ""}${firstEvidence.column != null ? `:${firstEvidence.column}` : ""}`
        : "N/A";

      lines.push(`### ${i + 1}. ${f.id}: ${f.title}`);
      lines.push("");
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| **Rule ID** | \`${f.id}\` |`);
      lines.push(`| **Severity** | ${severityBadge(f.severity)} ${SEVERITY_LABELS[f.severity]} |`);
      lines.push(`| **Category** | ${CATEGORY_LABELS[f.category] ?? f.category} |`);
      lines.push(`| **Location** | \`${location}\` |`);
      lines.push(`| **Score Penalty** | ${f.scorePenalty} |`);
      lines.push("");
      lines.push("**Description:**");
      lines.push("");
      lines.push(f.description);
      lines.push("");

      if (f.evidence.length > 0) {
        lines.push("**Evidence:**");
        lines.push("");
        for (const ev of f.evidence) {
          const evLoc = `${ev.file}${ev.line != null ? `:${ev.line}` : ""}`;
          lines.push(`- \`${evLoc}\``);
          if (ev.snippet) {
            const snippet = redactSnippet(ev.snippet);
            lines.push("  ```");
            lines.push(`  ${snippet.replace(/\n/g, "\n  ")}`);
            lines.push("  ```");
          }
        }
        lines.push("");
      }

      lines.push("**Remediation:**");
      lines.push("");
      lines.push(f.remediation);
      lines.push("");

      if (f.docUrl) {
        lines.push(`> 📖 [Documentation](${f.docUrl})`);
        lines.push("");
      }

      if (i < group.items.length - 1) {
        lines.push("---");
        lines.push("");
      }
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`_Report generated by RepoProof v${report.version} on ${report.timestamp}_`);
  lines.push("");

  return lines.join("\n");
}

function progressBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const blocks = "\u2588".repeat(Math.max(0, filled)) + "\u2591".repeat(Math.max(0, empty));
  return `${blocks} ${pct.toFixed(0)}%`;
}
