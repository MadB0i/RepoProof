import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 3;

const rule: Rule = {
  id: "env-documented",
  title: "Environment variables not documented",
  description:
    "Checks if environment variables used by the project are documented via a .env.example file or in the README.",
  severity: "info",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/env-documented",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      // Check if .env.example exists
      if (context.projectType.hasEnvExample) return [];

      // Check if README mentions environment variables
      const readmeFiles = context.files.filter((f) => /^readme/i.test(f.relativePath));
      for (const readme of readmeFiles) {
        if (
          /environment\s*variables/i.test(readme.content) ||
          /\.env/i.test(readme.content) ||
          /environment/i.test(readme.content)
        ) {
          return [];
        }
      }

      return [
        {
          id: this.id,
          title: this.title,
          description: "Environment variables are not documented",
          severity: "info",
          category: "repository-readiness",
          evidence: [],
          remediation:
            "Create a .env.example file with all required environment variables documented.",
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
