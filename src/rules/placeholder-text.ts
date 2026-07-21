import { Rule, RuleResult, ScanContext } from "../types.js";

const PLACEHOLDER_PATTERNS = [
  /\blorem\s+ipsum\b/i,
  /\bplaceholder\b/i,
  /\bcoming\s+soon\b/i,
  /\bunder\s+construction\b/i,
  /\bsample\s+text\b/i,
  /\breplace\s+me\b/i,
];

const MAX_PENALTY = 10;
const PENALTY_PER_FILE = 2;

// Check if text is inside a string literal or comment
function isInStringOrComment(line: string, matchIndex: number): boolean {
  const before = line.substring(0, matchIndex);
  const inComment = /\/\/[^]*$/.test(before) || /\/\*[^]*$/.test(before);
  const doubleQuotes = (before.match(/"/g) || []).length;
  const singleQuotes = (before.match(/'/g) || []).length;
  const backticks = (before.match(/`/g) || []).length;
  const inString = doubleQuotes % 2 === 1 || singleQuotes % 2 === 1 || backticks % 2 === 1;
  return inComment || inString || /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

const rule: Rule = {
  id: "placeholder-text",
  title: "Placeholder text in source code",
  description:
    "Detects placeholder text such as 'lorem ipsum', 'placeholder', 'coming soon', and other temporary content in source files.",
  severity: "warning",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_FILE,
  docUrl: "https://repoproof.dev/docs/rules/placeholder-text",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        const lines = file.content.split("\n");
        const evidenceLines: Array<{ line: number; snippet: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of PLACEHOLDER_PATTERNS) {
            const match = pattern.exec(line);
            if (match) {
              const matchIdx = match.index;
              if (isInStringOrComment(line, matchIdx)) {
                evidenceLines.push({
                  line: i + 1,
                  snippet: line.trim().substring(0, 120),
                });
                break;
              }
            }
          }
        }

        if (evidenceLines.length > 0) {
          findings.push({
            id: this.id,
            title: this.title,
            description: `File contains ${evidenceLines.length} placeholder text instance(s)`,
            severity: "warning",
            category: "incomplete-implementation",
            evidence: evidenceLines.map((e) => ({
              file: file.relativePath,
              line: e.line,
              snippet: e.snippet,
            })),
            remediation: "Replace placeholder text with actual content.",
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
