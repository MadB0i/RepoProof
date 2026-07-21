import { Rule, RuleResult, ScanContext } from "../types.js";

const DEBUG_PATTERNS = [
  /\bdebug\s*[=:]\s*true\b/i,
  /\bDEBUG\s*[=:]\s*["'`]true["'`]/i,
  /\bNODE_ENV\s*[=:]\s*["'`]development["'`]/i,
  /\bapp\.use\(\s*morgan\s*\(\s*["'`]dev["'`]/i,
  /\bapp\.use\(\s*logger\s*\(\s*["'`]dev["'`]/i,
  /\bvergbose\s*[=:]\s*true\b/i,
  /\blogLevel\s*[=:]\s*["'`]debug["'`]/i,
  /\blog_level\s*[=:]\s*["'`]debug["'`]/i,
];

const ALLOWED_PATTERNS = [
  /\/\/\s*debug/i,
  /\/\*\s*debug/i,
  /debug\s*[=:]\s*false/i,
  /isDebug\b/,
  /\.env\./i,
  /process\.env\./i,
  /config\.debug/i,
];

const CONFIG_FILE_PATTERNS = [
  /\.config\.(ts|js|json)$/,
  /config\.[tj]s$/i,
  /\/config\//i,
  /\/env\//i,
  /\/environment\//i,
];

const MAX_PENALTY = 8;
const PENALTY_PER_FINDING = 4;

const rule: Rule = {
  id: "debug-enabled",
  title: "Debug mode enabled by default",
  description:
    "Detects debug mode, development logging, or verbose settings that should not be enabled in production configurations.",
  severity: "warning",
  category: "security-configuration",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/debug-enabled",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        // Focus on config files and server entry files
        const isConfigOrServer =
          CONFIG_FILE_PATTERNS.some((p) => p.test(file.relativePath)) ||
          /server|app|main|index/.test(file.relativePath);
        if (!isConfigOrServer) continue;

        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (totalPenalty >= MAX_PENALTY) break;
          if (findings.length >= MAX_FINDINGS) break;

          const line = lines[i];

          for (const pattern of DEBUG_PATTERNS) {
            if (pattern.test(line)) {
              const isAllowed = ALLOWED_PATTERNS.some((ap) => ap.test(line));
              if (isAllowed) continue;

              findings.push({
                id: this.id,
                title: this.title,
                description: `Debug/development mode enabled: "${line.trim().substring(0, 80)}"`,
                severity: "warning",
                category: "security-configuration",
                evidence: [
                  {
                    file: file.relativePath,
                    line: i + 1,
                    snippet: line.trim().substring(0, 120),
                  },
                ],
                remediation: "Disable debug mode for production deployments.",
                scorePenalty: PENALTY_PER_FINDING,
                docUrl: this.docUrl,
              });
              totalPenalty += PENALTY_PER_FINDING;
              break;
            }
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
