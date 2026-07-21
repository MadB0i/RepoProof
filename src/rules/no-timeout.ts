import { Rule, RuleResult, ScanContext } from "../types.js";

const HTTP_CALL_PATTERNS = [
  /\bfetch\s*\(/g,
  /\baxios\s*(?:\.\w+)?\s*\(/g,
  /\baxios\.\w+\s*\(/g,
  /\bhttp\.get\s*\(/g,
  /\bhttp\.request\s*\(/g,
  /\bhttps\.get\s*\(/g,
  /\bhttps\.request\s*\(/g,
  /\bgot\s*\(/g,
  /\bsuperagent\s*\(/g,
  /\brequest\s*\(/g,
];

const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
  /\/mocks?\//,
  /\/fixtures?\//,
];

const MAX_PENALTY = 9;
const PENALTY_PER_FINDING = 3;

function hasTimeoutInContext(content: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 200);
  const end = Math.min(content.length, matchIndex + 500);
  const context = content.substring(start, end);

  // Check for timeout configuration patterns in the surrounding context
  const timeoutPatterns = [
    /\btimeout\s*[=:]\s*\d+/,
    /\.timeout\s*\(/,
    /\btimeout\s*:\s*\d+/,
    /\btimeout\s*=\s*\d+/,
    /\b_timeout\b/,
    /\btimeoutMs\b/,
    /\btimeout_ms\b/,
    /\brequestTimeout\b/,
    /\bconnectionTimeout\b/,
    /\bsocketTimeout\b/,
  ];

  for (const tp of timeoutPatterns) {
    if (tp.test(context)) return true;
  }

  return false;
}

const rule: Rule = {
  id: "no-http-timeout",
  title: "HTTP requests without timeout configuration",
  description:
    "Detects HTTP requests made without apparent timeout configuration, which can lead to hanging connections and resource exhaustion.",
  severity: "warning",
  category: "error-handling-reliability",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/no-timeout",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        // Skip test files
        const isTestFile = TEST_PATTERNS.some((p) => p.test(file.relativePath));
        if (isTestFile) continue;

        for (const pattern of HTTP_CALL_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;

          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const line = file.content.split("\n")[lineNo - 1] || "";

            // Skip if in a comment
            if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

            // Check if timeout is configured nearby
            if (hasTimeoutInContext(file.content, m.index)) continue;

            findings.push({
              id: this.id,
              title: this.title,
              description: `HTTP request without timeout: "${m[0].trim().substring(0, 60)}"`,
              severity: "warning",
              category: "error-handling-reliability",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet: line.trim().substring(0, 120),
                },
              ],
              remediation: "Add a timeout to this HTTP request.",
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
