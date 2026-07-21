import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 1;

const rule: Rule = {
  id: "code-of-conduct",
  title: "Missing CODE_OF_CONDUCT file",
  description:
    "Checks if the project has a CODE_OF_CONDUCT file, which establishes community guidelines and expectations for behavior.",
  severity: "info",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/code-of-conduct",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      if (context.projectType.hasCodeOfConduct) return [];

      return [
        {
          id: this.id,
          title: this.title,
          description: "Project does not have a CODE_OF_CONDUCT file",
          severity: "info",
          category: "repository-readiness",
          evidence: [],
          remediation: "Add a CODE_OF_CONDUCT.md file.",
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
