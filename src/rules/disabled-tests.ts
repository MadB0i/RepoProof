import { Rule, RuleResult, ScanContext } from "../types.js";

const DISABLED_PATTERNS = [
  /\b(describe|it|test)\.skip\b/,
  /\b(describe|it|test)\.only\b/,
  /\bxdescribe\b/,
  /\bxit\b/,
  /\bxtest\b/,
  /\beslint-disable[^\n]*jest\/no-disabled-tests/,
];

const MAX_PENALTY = 15;
const PENALTY_PER_FILE = 5;

const rule: Rule = {
  id: "disabled-tests",
  title: "Disabled or focused tests",
  description:
    "Detects tests that have been disabled (skipped) or focused (only), which can hide failing tests or cause incomplete test runs.",
  severity: "warning",
  category: "tests",
  scorePenalty: PENALTY_PER_FILE,
  docUrl: "https://repoproof.dev/docs/rules/disabled-tests",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        if (
          !file.relativePath.endsWith(".test.ts") &&
          !file.relativePath.endsWith(".test.tsx") &&
          !file.relativePath.endsWith(".test.js") &&
          !file.relativePath.endsWith(".spec.ts") &&
          !file.relativePath.endsWith(".spec.js") &&
          !file.relativePath.endsWith(".spec.tsx") &&
          !file.relativePath.endsWith("__tests__")
        ) {
          // Still check non-test files for .skip/.only on describe/it/test
          const testPatterns = /\b(describe|it|test)\.(skip|only)\b/;
          if (!testPatterns.test(file.content)) continue;
        }

        const lines = file.content.split("\n");
        const evidenceLines: Array<{ line: number; snippet: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of DISABLED_PATTERNS) {
            if (pattern.test(line)) {
              evidenceLines.push({
                line: i + 1,
                snippet: line.trim().substring(0, 120),
              });
              break;
            }
          }
        }

        if (evidenceLines.length > 0) {
          findings.push({
            id: this.id,
            title: this.title,
            description: `File contains ${evidenceLines.length} disabled/focused test(s)`,
            severity: "warning",
            category: "tests",
            evidence: evidenceLines.map((e) => ({
              file: file.relativePath,
              line: e.line,
              snippet: e.snippet,
            })),
            remediation: "Remove .skip and .only modifiers from tests.",
            scorePenalty: PENALTY_PER_FILE,
            docUrl: this.docUrl,
          });
          totalPenalty += PENALTY_PER_FILE;
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
