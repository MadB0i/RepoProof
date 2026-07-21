import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 3;

const rule: Rule = {
  id: "ci-workflow",
  title: "Missing CI/CD workflow",
  description:
    "Checks if the project has a CI workflow file (e.g., GitHub Actions, GitLab CI, CircleCI), which is essential for automated testing and quality assurance.",
  severity: "warning",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/ci-workflow",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasCiWorkflow) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a CI/CD workflow configuration",
          severity: "warning",
          category: "repository-readiness",
          evidence: [],
          remediation: "Set up a CI workflow (GitHub Actions, GitLab CI, etc.).",
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
