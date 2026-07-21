import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 2;

const rule: Rule = {
  id: "changelog-exists",
  title: "Missing CHANGELOG file",
  description:
    "Checks if the project has a CHANGELOG file, which documents version history and changes between releases.",
  severity: "warning",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/changelog-exists",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasChangelog) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a CHANGELOG file",
          severity: "warning",
          category: "repository-readiness",
          evidence: [],
          remediation: "Add a CHANGELOG.md file.",
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
