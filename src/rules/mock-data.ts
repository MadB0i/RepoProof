import { Rule, RuleResult, ScanContext } from "../types.js";

const SUSPICIOUS_PATTERNS = [
  /\b(mock|fake|dummy)\s*(data|response|api|user|request|server|service|handler|endpoint|route)\b/i,
  /\b(test123|password123|pass123|admin123)\b/i,
  /\badmin\b/i,
  /\bdemo\s*(user|account|login|credentials?|api|key|token|mode)\b/i,
];

const MAX_PENALTY = 10;
const PENALTY_PER_FINDING = 3;

function isInStringLiteral(line: string, matchIndex: number): boolean {
  const before = line.substring(0, matchIndex);
  const dq = (before.match(/"/g) || []).length;
  const sq = (before.match(/'/g) || []).length;
  const bt = (before.match(/`/g) || []).length;
  return dq % 2 === 1 || sq % 2 === 1 || bt % 2 === 1;
}

const rule: Rule = {
  id: "mock-data",
  title: "Hardcoded mock data in source code",
  description:
    "Detects hardcoded mock data, fake API responses, demo credentials, and placeholder data that should not appear in production code.",
  severity: "warning",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/mock-data",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (totalPenalty >= MAX_PENALTY) break;
          if (findings.length >= MAX_FINDINGS) break;

          const line = lines[i];

          for (const pattern of SUSPICIOUS_PATTERNS) {
            const match = pattern.exec(line);
            if (match) {
              if (isInStringLiteral(line, match.index)) {
                findings.push({
                  id: this.id,
                  title: this.title,
                  description: `Suspicious mock/test data: "${match[0].substring(0, 80)}"`,
                  severity: "warning",
                  category: "incomplete-implementation",
                  evidence: [
                    {
                      file: file.relativePath,
                      line: i + 1,
                      snippet: line.trim().substring(0, 120),
                    },
                  ],
                  remediation: "Remove mock data from production code.",
                  scorePenalty: PENALTY_PER_FINDING,
                  docUrl: this.docUrl,
                });
                totalPenalty += PENALTY_PER_FINDING;
                break;
              }
            }
          }
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
