import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 5;

const rule: Rule = {
  id: "missing-gitignore",
  title: "Missing .gitignore file",
  description:
    "Detects projects that do not have a .gitignore file, which can lead to sensitive files or build artifacts being committed.",
  severity: "warning",
  category: "security-configuration",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/missing-gitignore",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasGitignore) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a .gitignore file",
          severity: "warning",
          category: "security-configuration",
          evidence: [],
          remediation: "Create a .gitignore file for your project.",
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
