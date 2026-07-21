import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 1;

const rule: Rule = {
  id: "contributing-exists",
  title: "Missing CONTRIBUTING file",
  description:
    "Checks if the project has a CONTRIBUTING file, which helps standardize and encourage community contributions.",
  severity: "info",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/contributing-exists",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasContributing) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a CONTRIBUTING file",
          severity: "info",
          category: "repository-readiness",
          evidence: [],
          remediation: "Add a CONTRIBUTING.md file.",
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
