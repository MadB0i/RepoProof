import { Rule, RuleResult, ScanContext, SOURCE_CODE_EXTENSIONS } from "../types.js";

const CORS_PATTERNS = [
  /["'`]Access-Control-Allow-Origin["'`]\s*[=:]\s*["'`]\*["'`]/gi,
  /origin\s*[=:]\s*["'`]\*["'`]/gi,
  /\bAllowAllOrigins\b/g,
  /@CrossOrigin\s*\([^)]*origins?\s*=\s*["'`]\*["'`]/gi,
  /\.Set\("Access-Control-Allow-Origin",\s*"\*"\)/gi,
  /header\(\s*["'`]Access-Control-Allow-Origin["'`]\s*,\s*["'`]\*["'`]/gi,
];

const MAX_PENALTY = 10;
const PENALTY_PER_FINDING = 5;

const rule: Rule = {
  id: "wildcard-cors",
  title: "Wildcard CORS configuration",
  description:
    "Detects wildcard (*) CORS configurations that allow any origin to access the application, creating a security risk.",
  severity: "error",
  category: "security-configuration",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/wildcard-cors",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;
        const ext = file.relativePath.substring(file.relativePath.lastIndexOf("."));
        if (!SOURCE_CODE_EXTENSIONS.has(ext)) continue;

        for (const pattern of CORS_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;

          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const line = file.content.split("\n")[lineNo - 1] || "";

            findings.push({
              id: this.id,
              title: this.title,
              description: `Wildcard CORS configuration found: "${m[0].trim().substring(0, 80)}"`,
              severity: "error",
              category: "security-configuration",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet: line.trim().substring(0, 120),
                },
              ],
              remediation: "Restrict CORS to specific origins instead of using '*'.",
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
