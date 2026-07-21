import { Rule, RuleResult, ScanContext } from "../types.js";

const CLI_ENTRY_PATTERNS = [
  /\/bin\//,
  /\/cli\//,
  /\/scripts\//,
  /\/commands\//,
  /main\.(ts|js)$/,
  /cli\.(ts|js)$/,
  /entry\.(ts|js)$/,
  /index\.(ts|js)$/,
];

const MAX_PENALTY = 10;
const PENALTY_PER_FINDING = 5;

const rule: Rule = {
  id: "process-exit",
  title: "process.exit() in library or module code",
  description:
    "Detects process.exit() calls in files that are not CLI entry points. Calling process.exit() in library code can terminate the host process unexpectedly.",
  severity: "error",
  category: "error-handling-reliability",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/process-exit",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        // Skip files that are likely CLI entry points
        const isCliEntry = CLI_ENTRY_PATTERNS.some((p) => p.test(file.relativePath));
        if (isCliEntry) continue;

        // Skip non-JS/TS files
        if (
          !file.relativePath.endsWith(".ts") &&
          !file.relativePath.endsWith(".tsx") &&
          !file.relativePath.endsWith(".js") &&
          !file.relativePath.endsWith(".jsx") &&
          !file.relativePath.endsWith(".mjs") &&
          !file.relativePath.endsWith(".cjs")
        )
          continue;

        // Skip test files
        if (
          file.relativePath.endsWith(".test.ts") ||
          file.relativePath.endsWith(".spec.ts") ||
          file.relativePath.endsWith(".test.js") ||
          file.relativePath.endsWith(".spec.js")
        )
          continue;

        const processExitPattern = /\bprocess\.exit\s*\(/g;
        const matches = file.content.matchAll(processExitPattern);

        for (const m of matches) {
          if (totalPenalty >= MAX_PENALTY) break;
          if (findings.length >= MAX_FINDINGS) break;

          const lineNo = file.content.substring(0, m.index).split("\n").length;
          const line = file.content.split("\n")[lineNo - 1] || "";

          // Skip if in a comment
          if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*#/.test(line)) continue;

          findings.push({
            id: this.id,
            title: this.title,
            description: `process.exit() called in module file: ${file.relativePath}`,
            severity: "error",
            category: "error-handling-reliability",
            evidence: [
              {
                file: file.relativePath,
                line: lineNo,
                snippet: line.trim().substring(0, 120),
              },
            ],
            remediation: "Replace process.exit() with proper error handling.",
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
