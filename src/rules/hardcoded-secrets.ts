import { Rule, RuleResult, ScanContext } from "../types.js";

const SECRET_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    description: "Private key detected in source code",
  },
  {
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["'`][A-Za-z0-9_\-=]{16,}["'`]/gi,
    description: "API key detected in source code",
  },
  {
    pattern: /password\s*[=:]\s*["'`][^"'`]{4,}["'`]/gi,
    description: "Password detected in source code",
  },
  {
    pattern: /(?:secret|SECRET)\s*[=:]\s*["'`][^"'`]{8,}["'`]/gi,
    description: "Secret key detected in source code",
  },
  {
    pattern: /(?:token|TOKEN)\s*[=:]\s*["'`][A-Za-z0-9_\-.]{8,}["'`]/gi,
    description: "Token detected in source code",
  },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    description: "AWS access key ID detected",
  },
  {
    pattern: /\bgh[pso]_[A-Za-z0-9]{36,}\b/g,
    description: "GitHub token detected",
  },
  {
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
    description: "Stripe/OpenAI API key detected",
  },
  {
    pattern: /\bxf-[A-Za-z0-9_-]{20,}\b/g,
    description: "API key detected",
  },
];

const KNOWN_PLACEHOLDERS = /\b(YOUR_API_KEY_HERE|example-token|REDACTED)\b/;

const MAX_PENALTY = 30;
const PENALTY_PER_FINDING = 10;

function redactSnippet(snippet: string): string {
  return snippet
    .replace(/["'`][^"'`]{4,}["'`]/g, (match) => `${match[0]}[REDACTED]${match[match.length - 1]}`)
    .replace(
      /\b(AKIA[0-9A-Z]{16}|gh[pso]_[A-Za-z0-9]{36,}|sk-[A-Za-z0-9]{20,}|xf-[A-Za-z0-9_-]{20,})\b/g,
      "[REDACTED]",
    )
    .replace(
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      "-----BEGIN PRIVATE KEY-----[REDACTED]-----END PRIVATE KEY-----",
    );
}

const rule: Rule = {
  id: "hardcoded-secrets",
  title: "Hardcoded secrets in source code",
  description:
    "Detects likely hardcoded secrets, private keys, API tokens, and credentials in source files that pose a security risk.",
  severity: "error",
  category: "security-configuration",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/hardcoded-secrets",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        for (const { pattern, description } of SECRET_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;
          if (findings.length >= MAX_FINDINGS) break;

          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const line = file.content.split("\n")[lineNo - 1] || "";
            if (KNOWN_PLACEHOLDERS.test(line)) continue;
            const rawSnippet = m[0].substring(0, 120);
            const snippet = redactSnippet(rawSnippet);

            findings.push({
              id: this.id,
              title: this.title,
              description: `${description} in ${file.relativePath}`,
              severity: "error",
              category: "security-configuration",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet,
                },
              ],
              remediation: "Remove hardcoded secret and use environment variables.",
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
