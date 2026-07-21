import { Rule, RuleResult, ScanContext } from "../types.js";

const UNBOUNDED_PATTERNS = [
  // while(true) with retry
  { pattern: /while\s*\(true\)\s*\{[\s\S]*?(?:retry|try)/gi, label: "while(true) loop with retry" },
  // for(;;) with retry
  { pattern: /for\s*\(;;\)\s*\{[\s\S]*?(?:retry|try)/gi, label: "for(;;) loop with retry" },
  // setTimeout in catch without max retry check
  { pattern: /catch[\s\S]*?setTimeout\s*\(/gi, label: "setTimeout in catch block" },
  // Unbounded exponential backoff without max
  { pattern: /(?:retry|attempt|tries)\s*[<]?\s*\d+/gi, label: "retry attempt counter" },
];

const ALLOWED_PATTERNS = [
  /\bmax(?:Retries|Attempts|Tries)\s*[=:]\s*\d+/i,
  /\bmaxRetries\b/i,
  /\bmaxAttempts\b/i,
  /\bMAX_RETRIES\b/i,
  /\bMAX_ATTEMPTS\b/i,
  /\bretryCount\s*[<>=]+\s*\d+/i,
  /\battempts\s*[<>=]+\s*\d+/i,
  /\btries\s*[<>=]+\s*\d+/i,
  /\bretryLimit\b/i,
  /\bmaxRetryTime\b/i,
  /\bretry\s*:\s*\{/i,
];

const MAX_PENALTY = 8;
const PENALTY_PER_FINDING = 4;

const rule: Rule = {
  id: "unbounded-retries",
  title: "Unbounded retry loops",
  description:
    "Detects retry mechanisms without a maximum count or timeout cap, which can lead to infinite loops or resource exhaustion.",
  severity: "warning",
  category: "error-handling-reliability",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/unbounded-retries",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        // Only check source files (not dist, etc.)
        if (
          file.relativePath.includes("node_modules") ||
          file.relativePath.includes("dist") ||
          file.relativePath.includes("build")
        )
          continue;

        for (const { pattern, label } of UNBOUNDED_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;

          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            // Check if there's a bounded retry pattern nearby
            const contextBefore = file.content.substring(
              Math.max(0, m.index - 300),
              m.index + m[0].length + 100,
            );
            const hasBound = ALLOWED_PATTERNS.some((ap) => ap.test(contextBefore));
            if (hasBound) continue;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const line = file.content.split("\n")[lineNo - 1] || "";

            findings.push({
              id: this.id,
              title: this.title,
              description: `Unbounded retry: ${label}`,
              severity: "warning",
              category: "error-handling-reliability",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet: line.trim().substring(0, 120),
                },
              ],
              remediation: "Add a maximum retry count or timeout to cap retries.",
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
