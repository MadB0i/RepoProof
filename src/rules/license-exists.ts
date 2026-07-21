import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 3;

const rule: Rule = {
  id: "license-exists",
  title: "Missing LICENSE file",
  description:
    "Checks if the project has a LICENSE file, which is important for clarifying usage rights and contribution terms.",
  severity: "info",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/license-exists",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasLicense) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a LICENSE file",
          severity: "info",
          category: "repository-readiness",
          evidence: [],
          remediation: "Add a LICENSE file to clarify usage rights.",
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
