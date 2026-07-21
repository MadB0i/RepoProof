import { ScanReport } from "../types.js";
import { redactSnippet } from "../engine/redact.js";

export interface JsonReport {
  $schema: string;
  version: string;
  timestamp: string;
  score: number;
  grade: string;
  maxScore: number;
  projectType: import("../types.js").ProjectType;
  categoryScores: Record<string, { score: number; maxScore: number; findings: number }>;
  findings: import("../types.js").RuleResult[];
  summary: {
    totalFindings: number;
    errors: number;
    warnings: number;
    info: number;
    passedChecks: number;
  };
}

function redactReport(report: ScanReport): ScanReport {
  const redacted = { ...report, findings: report.findings.map((f) => ({ ...f, evidence: f.evidence.map((e) => ({ ...e, snippet: e.snippet ? redactSnippet(e.snippet) : e.snippet })) })) };
  return redacted;
}

export function generateJsonReport(report: ScanReport): string {
  const redacted = redactReport(report);
  const jsonReport: JsonReport = {
    $schema: "https://raw.githubusercontent.com/anomalyco/repoproof/main/schemas/report-v1.json",
    version: redacted.version,
    timestamp: redacted.timestamp,
    score: redacted.score,
    grade: redacted.grade,
    maxScore: redacted.maxScore,
    projectType: redacted.projectType,
    categoryScores: redacted.categoryScores,
    findings: redacted.findings,
    summary: redacted.summary,
  };

  return JSON.stringify(jsonReport, null, 2);
}
