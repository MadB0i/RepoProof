import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 8;

const rule: Rule = {
  id: "env-tracked",
  title: ".env file tracked in repository",
  description:
    "Detects .env files that appear to be tracked in the repository. .env files often contain secrets and should not be committed.",
  severity: "error",
  category: "security-configuration",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/env-tracked",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      // Check for any .env files that are not .env.example or .env.template
      const envFiles = context.files.filter((f) => {
        const rp = f.relativePath.toLowerCase();
        if (!rp.includes(".env")) return false;
        // Allow .env.example, .env.template, .env.sample, .env.local.example
        if (rp.endsWith(".example")) return false;
        if (rp.endsWith(".template")) return false;
        if (rp.endsWith(".sample")) return false;
        if (rp.endsWith(".dist")) return false;
        // Must be exactly .env or .env.* (but not .env.example etc.)
        if (rp === ".env") return true;
        if (/^\.env\.(?!example|template|sample|dist)\w+$/.test(rp)) return true;
        return false;
      });

      if (envFiles.length === 0) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: `${envFiles.length} .env file(s) found tracked in the repository`,
          severity: "error",
          category: "security-configuration",
          evidence: envFiles.map((f) => ({
            file: f.relativePath,
          })),
          remediation: "Add .env to .gitignore and use .env.example instead.",
          scorePenalty: PENALTY,
          docUrl: this.docUrl,
        },
      ];
    } catch {
      return [];
    }
  },
};

export { rule };
