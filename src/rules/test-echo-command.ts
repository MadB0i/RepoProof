import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 8;

const rule: Rule = {
  id: "test-echo-command",
  title: "Test script is an echo placeholder",
  description:
    "Detects when the test script in package.json is just an echo command instead of an actual test runner.",
  severity: "error",
  category: "tests",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/test-echo-command",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      // Find package.json
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

      const testScript =
        scripts.test || scripts.testci || scripts["test:ci"] || scripts["test:unit"];
      if (!testScript) return [];

      const echoPatterns = [
        /^echo\s/,
        /echo\s+["'].*success["']/i,
        /echo\s+["']no tests/i,
        /echo\s+["']placeholder/i,
        /echo\s+["']pass/i,
      ];

      for (const pattern of echoPatterns) {
        if (pattern.test(testScript.trim())) {
          return [
            {
              id: this.id,
              title: this.title,
              description: `Test script is just an echo command: "${testScript.trim().substring(0, 80)}"`,
              severity: "error",
              category: "tests",
              evidence: [
                {
                  file: "package.json",
                  snippet: `"test": "${testScript.trim().substring(0, 100)}"`,
                },
              ],
              remediation: "Replace echo with actual test runner command.",
              scorePenalty: PENALTY,
              docUrl: this.docUrl,
            },
          ];
        }
      }

      return [];
    } catch {
      return [];
    }
  },
};

export { rule };
