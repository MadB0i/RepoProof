import { ScanReport, Category } from "../types.js";
import { getResultsBySeverity } from "../engine/rule-runner.js";
import { redactSnippet } from "../engine/redact.js";

export interface TextReporterOptions {
  noColor?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  "incomplete-implementation": "Incomplete Implementation",
  tests: "Tests",
  "security-configuration": "Security Configuration",
  "error-handling-reliability": "Error Handling & Reliability",
  "repository-readiness": "Repository Readiness",
};

const SEVERITY_ICON: Record<string, string> = {
  error: "\u2716",
  warning: "\u26A0",
  info: "\u2139",
};

function formatBold(text: string, noColor: boolean): string {
  if (noColor) return text;
  return `\x1B[1m${text}\x1B[22m`;
}

function formatSeverity(severity: string, noColor: boolean): string {
  if (noColor) return severity.toUpperCase();
  switch (severity) {
    case "error":
      return `\x1B[31m${severity.toUpperCase()}\x1B[39m`;
    case "warning":
      return `\x1B[33m${severity.toUpperCase()}\x1B[39m`;
    case "info":
      return `\x1B[36m${severity.toUpperCase()}\x1B[39m`;
    default:
      return severity.toUpperCase();
  }
}

function formatScore(score: number, noColor: boolean): string {
  const display = `${score.toFixed(1)}/100`;
  if (noColor) return display;
  if (score >= 80) return `\x1B[32m${display}\x1B[39m`;
  if (score >= 60) return `\x1B[33m${display}\x1B[39m`;
  return `\x1B[31m${display}\x1B[39m`;
}

function formatGrade(grade: string, noColor: boolean): string {
  if (noColor) return grade;
  if (grade === "A") return `\x1B[32m${grade}\x1B[39m`;
  if (grade === "B") return `\x1B[32m${grade}\x1B[39m`;
  if (grade === "C") return `\x1B[33m${grade}\x1B[39m`;
  if (grade === "D") return `\x1B[33m${grade}\x1B[39m`;
  return `\x1B[31m${grade}\x1B[39m`;
}

function formatEvidencePath(evidence: { file: string; line?: number; column?: number }): string {
  let path = evidence.file;
  if (evidence.line != null) {
    path += `:${evidence.line}`;
    if (evidence.column != null) {
      path += `:${evidence.column}`;
    }
  }
  return path;
}

function renderScoreBar(score: number, width: number, noColor: boolean): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, empty));
  if (noColor) return `[${"=".repeat(filled)}${"-".repeat(Math.max(0, empty))}]`;
  if (score >= 80) return `\x1B[32m${bar}\x1B[39m`;
  if (score >= 60) return `\x1B[33m${bar}\x1B[39m`;
  return `\x1B[31m${bar}\x1B[39m`;
}

export function generateTextReport(report: ScanReport, options?: TextReporterOptions): string {
  const noColor = options?.noColor ?? false;
  const quiet = options?.quiet ?? false;
  const verbose = options?.verbose ?? false;
  const lines: string[] = [];
  const sep = noColor ? "=".repeat(60) : `\x1B[90m${"\u2500".repeat(60)}\x1B[39m`;
  const thinSep = noColor ? "-".repeat(60) : `\x1B[90m${"\u2504".repeat(60)}\x1B[39m`;

  const { errors, warnings, info } = getResultsBySeverity(report.findings);

  // Header
  lines.push("");
  lines.push(formatBold("RepoProof \u2014 Repository Quality Audit", noColor));
  lines.push(sep);
  lines.push("");

  if (!quiet) {
    // Score and grade
    lines.push(`  ${formatBold("Overall Score:", noColor)} ${formatScore(report.score, noColor)}`);
    lines.push(`  ${formatBold("Grade:", noColor)}        ${formatGrade(report.grade, noColor)}`);
    lines.push(`  ${renderScoreBar(report.score, 40, noColor)}`);
    lines.push("");
    lines.push(thinSep);
    lines.push("");

    // Summary
    lines.push(`  ${formatBold("Summary", noColor)}`);
    lines.push(`    Total Findings:  ${report.summary.totalFindings}`);
    lines.push(`    Errors:          ${errors.length}`);
    lines.push(`    Warnings:        ${warnings.length}`);
    lines.push(`    Info:            ${info.length}`);
    lines.push(`    Passed Checks:   ${report.summary.passedChecks}`);
    lines.push("");
    lines.push(thinSep);
    lines.push("");
  }

  // Findings grouped by severity
  const severityOrder = [
    ["error", errors],
    ["warning", warnings],
    ["info", info],
  ] as const;
  let hasAnyFindings = false;

  for (const [severity, findings] of severityOrder) {
    if (findings.length === 0) continue;
    hasAnyFindings = true;
    const icon = SEVERITY_ICON[severity] ?? "";
    lines.push(
      `  ${formatBold(`${icon} ${severity.toUpperCase()} (${findings.length})`, noColor)}`,
    );
    lines.push("");

    for (const finding of findings) {
      const sevLabel = formatSeverity(finding.severity, noColor);
      const firstEvidence = finding.evidence[0];
      const location = firstEvidence ? formatEvidencePath(firstEvidence) : "(no location)";
      lines.push(`    [${sevLabel}] ${finding.id} \u2014 ${finding.title}`);
      lines.push(`            ${location}`);

      if (verbose) {
        lines.push(`            ${finding.description}`);
        lines.push(`            Remediation: ${finding.remediation}`);
        if (finding.docUrl) {
          lines.push(`            Docs: ${finding.docUrl}`);
        }
        if (finding.evidence.length > 0 && finding.evidence[0].snippet) {
          const snippet = redactSnippet(finding.evidence[0].snippet);
          const snippetLines = snippet.split("\n").filter((s) => s.trim().length > 0);
          for (const sl of snippetLines.slice(0, 5)) {
            lines.push(`            | ${sl.trim()}`);
          }
        }
        lines.push("");
      } else {
        lines.push("");
      }
    }
  }

  if (!hasAnyFindings) {
    lines.push(`  ${formatBold("No findings. All checks passed.", noColor)}`);
    lines.push("");
  }

  if (!quiet) {
    // Category summary
    lines.push(thinSep);
    lines.push("");
    lines.push(`  ${formatBold("Category Breakdown", noColor)}`);
    lines.push("");

    const categories = Object.keys(report.categoryScores) as Category[];
    for (const cat of categories) {
      const catScore = report.categoryScores[cat];
      const label = CATEGORY_LABELS[cat] ?? cat;
      const bar = renderScoreBar((catScore.score / catScore.maxScore) * 100, 20, noColor);
      lines.push(
        `  ${bar}  ${label.padEnd(32)} ${catScore.score.toFixed(1)}/${catScore.maxScore}  (${catScore.findings} findings)`,
      );
    }

    lines.push("");

    const allPassed = errors.length === 0 && warnings.length === 0;
    lines.push(thinSep);
    lines.push("");

    // Suggested next commands
    lines.push(`  ${formatBold("Next Steps", noColor)}`);
    lines.push("");

    if (report.findings.length > 0) {
      lines.push("    Review the findings above and address each issue.");
      lines.push("    Re-run the audit after making improvements:");
      lines.push(`    $ repoproof`);
    }
    if (allPassed) {
      lines.push("    Your repository is in good shape!");
    }

    lines.push(`    Report generated: ${report.timestamp}`);
    lines.push(`    RepoProof v${report.version}`);
    lines.push("");
  } else {
    // Quiet mode: just show score and finding count
    if (hasAnyFindings) {
      lines.push(
        `  ${report.score.toFixed(1)}/100 (${report.grade}) \u2014 ${report.summary.totalFindings} finding(s)`,
      );
    } else {
      lines.push(`  ${report.score.toFixed(1)}/100 (${report.grade}) \u2014 All clear`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
