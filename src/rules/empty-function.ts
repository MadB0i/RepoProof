import { Rule, RuleResult, ScanContext, SOURCE_CODE_EXTENSIONS } from "../types.js";

const CONTROL_KEYWORDS = new Set(["if", "else", "for", "while", "switch", "catch", "try", "do"]);

const MAX_PENALTY = 10;
const PENALTY_PER_FINDING = 3;

// Strip strings and comments to avoid false matches
function stripStringsAndComments(content: string): string {
  return content
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`[^`]*`/g, "''")
    .replace(/"[^"]*"/g, "''")
    .replace(/'[^']*'/g, "''");
}

function findEmptyFunctions(
  content: string,
  _filePath: string,
): Array<{ line: number; snippet: string }> {
  const results: Array<{ line: number; snippet: string }> = [];
  const cleaned = stripStringsAndComments(content);

  // Match empty brace pairs and check context
  const braceRegex = /\{[\s\n]*\}/g;
  let match: RegExpExecArray | null;

  while ((match = braceRegex.exec(cleaned)) !== null) {
    const before = cleaned.substring(0, match.index);

    // Check if it looks like a function/method/arrow
    const funcMatch = before.match(
      /(?:function\s+\w*\s*\([^)]*\)|\b\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?|=>)\s*$/,
    );
    if (!funcMatch) continue;

    const funcText = funcMatch[0];
    const nameMatch = funcText.match(/\b(\w+)\s*\(/);
    if (nameMatch) {
      const name = nameMatch[1].toLowerCase();
      if (CONTROL_KEYWORDS.has(name)) continue;
    }

    // Exclude if preceded by "abstract" (within 20 chars)
    const beforeTrimmed = before.replace(/\s+/g, " ").trimEnd();
    if (/\babstract\b/.test(beforeTrimmed.substring(Math.max(0, beforeTrimmed.length - 30))))
      continue;

    // Exclude if inside an interface block
    const previousContent = before.substring(Math.max(0, before.length - 500));
    const lastBrace = previousContent.lastIndexOf("{");
    const blockBefore = lastBrace >= 0 ? previousContent.substring(0, lastBrace) : previousContent;
    if (/\binterface\s+\w+[\s\S]*$/.test(blockBefore)) continue;

    const lineNo = content.substring(0, match.index).split("\n").length;
    const snippet = funcText.trim().substring(0, 80) + " {}";
    results.push({ line: lineNo, snippet });
  }

  return results;
}

const rule: Rule = {
  id: "empty-function",
  title: "Empty function bodies",
  description:
    "Detects function or method declarations with empty bodies that are not abstract or interface declarations.",
  severity: "warning",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/empty-function",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;
        const ext = file.relativePath.substring(file.relativePath.lastIndexOf("."));
        if (!SOURCE_CODE_EXTENSIONS.has(ext)) continue;

        const emptyFuncs = findEmptyFunctions(file.content, file.relativePath);
        for (const ef of emptyFuncs) {
          if (totalPenalty >= MAX_PENALTY) break;
          if (findings.length >= MAX_FINDINGS) break;

          findings.push({
            id: this.id,
            title: this.title,
            description: `Found empty function body: ${ef.snippet}`,
            severity: "warning",
            category: "incomplete-implementation",
            evidence: [
              {
                file: file.relativePath,
                line: ef.line,
                snippet: ef.snippet,
              },
            ],
            remediation: "Implement or remove the empty function.",
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
