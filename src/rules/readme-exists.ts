import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 5;

const rule: Rule = {
  id: "readme-exists",
  title: "Missing README file",
  description:
    "Checks if the project has a README file, which is essential for documenting the project purpose, setup, and usage.",
  severity: "info",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/readme-exists",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasReadme) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a README file",
          severity: "info",
          category: "repository-readiness",
          evidence: [],
          remediation: "Create a README.md for the project.",
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
