import { ScanReport, RuleResult } from "../types.js";

export interface SarifOptions {
  repoUri?: string;
  commitSha?: string;
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  resources?: { rules: SarifRule[] };
  invocations?: SarifInvocation[];
  versionControlProvenance?: SarifVersionControl[];
  properties?: Record<string, unknown>;
}

interface SarifTool {
  driver: SarifDriver;
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules?: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  fullDescription: SarifMultiformatMessage;
  helpUri?: string;
  help?: SarifMultiformatMessage;
  properties?: Record<string, unknown>;
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: string;
  message: SarifMultiformatMessage;
  locations: SarifLocation[];
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine: number;
      startColumn?: number;
    };
  };
}

interface SarifMultiformatMessage {
  text: string;
  markdown?: string;
}

interface SarifInvocation {
  executionSuccessful: boolean;
  endTimeUtc: string;
}

interface SarifVersionControl {
  repositoryUri: string;
  revisionId?: string;
  branch?: string;
}

function severityToLevel(severity: string): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
    default:
      return "none";
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]()])/g, "\\$1");
}

function buildRuleIndexMap(findings: RuleResult[]): Map<string, number> {
  const seen = new Map<string, number>();
  let idx = 0;
  for (const f of findings) {
    if (!seen.has(f.id)) {
      seen.set(f.id, idx++);
    }
  }
  return seen;
}

function buildRulesList(findings: RuleResult[]): SarifRule[] {
  const seen = new Map<string, RuleResult>();
  for (const f of findings) {
    if (!seen.has(f.id)) {
      seen.set(f.id, f);
    }
  }
  const rules: SarifRule[] = [];
  for (const [id, f] of seen) {
    rules.push({
      id,
      name: f.title,
      fullDescription: {
        text: f.description,
        markdown: escapeMarkdown(f.description),
      },
      helpUri: f.docUrl || undefined,
      help: {
        text: f.remediation,
        markdown: escapeMarkdown(f.remediation),
      },
      properties: {
        category: f.category,
        scorePenalty: f.scorePenalty,
        severity: f.severity,
      },
    });
  }
  return rules;
}

export function generateSarifReport(report: ScanReport, options?: SarifOptions): string {
  const findings = report.findings;
  const ruleIndexMap = buildRuleIndexMap(findings);
  const rules = buildRulesList(findings);

  const results: SarifResult[] = findings.map((f) => {
    const locations: SarifLocation[] = f.evidence.map((ev) => ({
      physicalLocation: {
        artifactLocation: {
          uri: ev.file.replace(/\\/g, "/"),
        },
        region:
          ev.line != null
            ? {
                startLine: ev.line,
                startColumn: ev.column ?? undefined,
              }
            : undefined,
      },
    }));

    const fallbackLocation: SarifLocation = {
      physicalLocation: {
        artifactLocation: {
          uri: "REPORT_ROOT",
        },
      },
    };

    return {
      ruleId: f.id,
      ruleIndex: ruleIndexMap.get(f.id) ?? 0,
      level: severityToLevel(f.severity),
      message: {
        text: `${f.title}: ${f.description}`,
        markdown: `**${escapeMarkdown(f.title)}**: ${escapeMarkdown(f.description)}`,
      },
      locations: locations.length > 0 ? locations : [fallbackLocation],
      properties: {
        category: f.category,
        scorePenalty: f.scorePenalty,
        remediation: f.remediation,
      },
    };
  });

  const sarifLog: SarifLog = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "RepoProof",
            version: report.version,
            informationUri: "https://github.com/anomalyco/repoproof",
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: new Date(report.timestamp).toISOString(),
          },
        ],
        properties: {
          score: report.score,
          grade: report.grade,
          maxScore: report.maxScore,
          totalFindings: report.summary.totalFindings,
        },
      },
    ],
  };

  const sarifRun = sarifLog.runs[0];

  if (options?.repoUri) {
    sarifRun.versionControlProvenance = [
      {
        repositoryUri: options.repoUri,
        revisionId: options.commitSha,
      },
    ];
  }

  return JSON.stringify(sarifLog, null, 2);
}
