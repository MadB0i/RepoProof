import { Rule, RuleResult, ScanContext, SOURCE_CODE_EXTENSIONS } from "../types.js";

const EMPTY_CATCH_PATTERNS = [
  // catch(e) {}
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g,
  // catch {}
  /catch\s*\{\s*\}/g,
  // catch(e) { /* single comment with ignore */ }
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\/\/\s*(?:ignore|nop|silently|empty)\s*\s*\}/gi,
  // Multiline: catch(e) {\n  }
  /catch\s*\(\s*\w+\s*\)\s*\{[\s\n]*\}/g,
  // Multiline: catch {\n  }
  /catch\s*\{[\s\n]*\}/g,
];

const MAX_PENALTY = 12;
const PENALTY_PER_FINDING = 4;

function stripStrings(content: string): string {
  return content
    .replace(/`[^`]*`/g, "''")
    .replace(/"[^"]*"/g, "''")
    .replace(/'[^']*'/g, "''")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const rule: Rule = {
  id: "empty-catch",
  title: "Empty catch blocks",
  description:
    "Detects empty catch blocks that silently swallow errors, making debugging difficult and hiding potential failures.",
  severity: "warning",
  category: "error-handling-reliability",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/empty-catch",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;
        const ext = file.relativePath.substring(file.relativePath.lastIndexOf("."));
        if (!SOURCE_CODE_EXTENSIONS.has(ext)) continue;

        const cleaned = stripStrings(file.content);

        for (const pattern of EMPTY_CATCH_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;

          const matches = cleaned.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const rawLine = file.content.split("\n")[lineNo - 1] || "";

            findings.push({
              id: this.id,
              title: this.title,
              description: "Empty catch block that silently swallows errors",
              severity: "warning",
              category: "error-handling-reliability",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet: rawLine.trim().substring(0, 120),
                },
              ],
              remediation: "Handle or log errors in catch blocks.",
              scorePenalty: PENALTY_PER_FINDING,
              docUrl: this.docUrl,
            });
            totalPenalty += PENALTY_PER_FINDING;
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
