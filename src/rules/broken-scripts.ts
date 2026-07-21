import { Rule, RuleResult, ScanContext } from "../types.js";

const MAX_PENALTY = 9;
const PENALTY_PER_FINDING = 3;

const SUSPICIOUS_COMMANDS = [
  /^echo\s+/i,
  /^exit\s+0/i,
  /^true$/i,
  /^:\s*$/i,
  /^#\s/,
  /^rem\s+/i,
  /^\s*$/,
];

const SCRIPT_NAME_PATTERNS = [
  "test",
  "testci",
  "test:ci",
  "test:unit",
  "test:integration",
  "build",
  "start",
  "lint",
  "typecheck",
  "format",
  "deploy",
  "check",
  "validate",
  "verify",
  "ci",
  "release",
  "publish",
];

const rule: Rule = {
  id: "broken-scripts",
  title: "Broken or placeholder script definitions in package.json",
  description:
    "Detects scripts in package.json that reference non-existent commands or are echo-based placeholders pretending to be real scripts.",
  severity: "error",
  category: "repository-readiness",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/broken-scripts",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const pkgFile = context.files.find((f) => f.relativePath === "package.json");
      if (!pkgFile) return [];

      let pkg: Record<string, unknown>;
      try {
        pkg = JSON.parse(pkgFile.content);
      } catch {
        return [];
      }

      const scripts = pkg.scripts as Record<string, string> | undefined;
      if (!scripts) return [];

      const issues: Array<{ name: string; value: string }> = [];

      for (const [name, value] of Object.entries(scripts)) {
        if (typeof value !== "string") continue;
        const trimmed = value.trim();

        // Check for echo-based or empty scripts
        for (const suspicious of SUSPICIOUS_COMMANDS) {
          if (suspicious.test(trimmed)) {
            issues.push({ name, value: trimmed });
            break;
          }
        }

        // Check if a common script name has a suspicious value
        if (SCRIPT_NAME_PATTERNS.includes(name)) {
          if (
            !trimmed ||
            trimmed.includes("echo") ||
            /^node\s+-e/.test(trimmed) ||
            /^echo\s+/i.test(trimmed)
          ) {
            if (!issues.some((i) => i.name === name)) {
              issues.push({ name, value: trimmed || "(empty)" });
            }
          }
        }
      }

      if (issues.length === 0) return [];

      const maxIssues = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);
      return issues.slice(0, maxIssues).map((issue) => ({
        id: this.id,
        title: this.title,
        description: `Suspicious script "${issue.name}": "${issue.value.substring(0, 60)}"`,
        severity: "error",
        category: "repository-readiness",
        evidence: [
          {
            file: "package.json",
            snippet: `"${issue.name}": "${issue.value.substring(0, 100)}"`,
          },
        ],
        remediation: `Fix the "${issue.name}" script with a valid command.`,
        scorePenalty: PENALTY_PER_FINDING,
        docUrl: this.docUrl,
      }));
    } catch {
      return [];
    }
  },
};

export { rule };
