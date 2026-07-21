import { Rule, RuleResult, ScanContext } from "../types.js";

const PATTERNS = [
  // throw new Error("not implemented"), throw new Error("TODO"), etc.
  /throw\s+new\s+\w+\s*\([^)]*\b(not\s+implemented|unimplemented|stub|todo|fixme)\b[^)]*\)/gi,
  // return "not implemented", return "TODO", etc.
  /return\s+["'`][^"'`]*\b(not\s+implemented|unimplemented|stub|todo|fixme)\b[^"'`]*["'`]/gi,
  // "not implemented", "unimplemented" in any string literal with assignment or comparison context
  /(?:=|\breturn\b|\bthrow\b)\s*["'`][^"'`]*\b(not\s+implemented|unimplemented)\b[^"'`]*["'`]/gi,
  // Stub marker in throw statements
  /throw\s+new\s+\w+\s*\([^)]*\bstub\b[^)]*\)/gi,
];

const MAX_PENALTY = 15;
const PENALTY_PER_FINDING = 5;

const rule: Rule = {
  id: "not-implemented",
  title: "Not implemented code paths",
  description:
    "Detects code paths marked as not implemented, unimplemented, stubs, or TODO placeholders that indicate incomplete logic.",
  severity: "error",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/not-implemented",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;
        const fileFindings: Array<{ line: number; snippet: string; match: string }> = [];

        for (const pattern of PATTERNS) {
          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const snippet = m[0].trim().substring(0, 120);
            fileFindings.push({ line: lineNo, snippet, match: m[0] });
          }
        }

        // Deduplicate by line
        const seen = new Set<number>();
        const unique = fileFindings.filter((f) => {
          if (seen.has(f.line)) return false;
          seen.add(f.line);
          return true;
        });

        for (const finding of unique) {
          if (totalPenalty >= MAX_PENALTY) break;
          findings.push({
            id: this.id,
            title: this.title,
            description: `Found not-implemented code path: "${finding.match.substring(0, 80)}"`,
            severity: "error",
            category: "incomplete-implementation",
            evidence: [
              {
                file: file.relativePath,
                line: finding.line,
                snippet: finding.snippet,
              },
            ],
            remediation: "Implement the missing functionality.",
            scorePenalty: PENALTY_PER_FINDING,
            docUrl: this.docUrl,
          });
          totalPenalty += PENALTY_PER_FINDING;
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
