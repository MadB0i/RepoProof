import { Rule, RuleResult, ScanContext } from "../types.js";

const MARKER_PATTERN = /\b(TODO|FIXME|HACK|XXX|BUG|WORKAROUND)\b/gi;
const SKIP_PATTERNS = [/@todo\s/i, /@fixme\s/i, /@example\b/i, /usage example/i, /\(todo:/i];

const MAX_PENALTY = 10;
const PENALTY_PER_FILE = 2;

function isMarkerInCode(line: string): boolean {
  if (!MARKER_PATTERN.test(line)) return false;
  MARKER_PATTERN.lastIndex = 0;
  const skip = SKIP_PATTERNS.some((p) => p.test(line));
  if (skip) return false;
  const hasComment = /\/\/|\/\*|\*\/|#/.test(line);
  const hasString = /["'`]/.test(line);
  return hasComment || hasString || /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

const rule: Rule = {
  id: "todo-fixme",
  title: "TODO/FIXME markers in source code",
  description:
    "Detects TODO, FIXME, HACK, XXX, BUG, WORKAROUND markers left in source code that indicate incomplete implementations.",
  severity: "warning",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_FILE,
  docUrl: "https://repoproof.dev/docs/rules/todo-fixme",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        const lines = file.content.split("\n");
        const evidenceLines: Array<{ line: number; snippet: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          if (isMarkerInCode(lines[i])) {
            evidenceLines.push({
              line: i + 1,
              snippet: lines[i].trim().substring(0, 120),
            });
          }
        }

        if (evidenceLines.length > 0) {
          findings.push({
            id: this.id,
            title: this.title,
            description: `File contains ${evidenceLines.length} TODO/FIXME markers`,
            severity: "warning",
            category: "incomplete-implementation",
            evidence: evidenceLines.map((e) => ({
              file: file.relativePath,
              line: e.line,
              snippet: e.snippet,
            })),
            remediation: "Remove or resolve all TODO/FIXME markers.",
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
