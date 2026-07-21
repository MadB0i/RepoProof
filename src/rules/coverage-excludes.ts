import { Rule, RuleResult, ScanContext } from "../types.js";

const CONFIG_FILES = [
  "vitest.config.ts",
  "vitest.config.js",
  "jest.config.js",
  "jest.config.ts",
  ".nycrc",
  ".nycrc.json",
  "nyc.config.js",
  "c8.json",
  ".c8rc",
  "istanbul.yml",
  "codecov.yml",
  "codecov.yaml",
];

const EXCESSIVE_EXCLUDE_PATTERNS = [
  /\*\*\/(node_modules|dist|build|coverage)\/\*\*/i,
  /src\/(?!.*test)/i,
  /\.(test|spec)\.\w+$/i,
];

const PENALTY = 4;

const rule: Rule = {
  id: "coverage-excludes",
  title: "Coverage configuration excludes too many source files",
  description:
    "Detects coverage configuration that excludes a large portion of source files from coverage reporting.",
  severity: "warning",
  category: "tests",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/coverage-excludes",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const configEvidence: Array<{ file: string; line: number; snippet: string }> = [];

      for (const file of context.files) {
        const isConfigFile = CONFIG_FILES.some(
          (cf) => file.relativePath === cf || file.relativePath.endsWith("/" + cf),
        );
        if (!isConfigFile) continue;

        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of EXCESSIVE_EXCLUDE_PATTERNS) {
            if (pattern.test(line)) {
              configEvidence.push({
                file: file.relativePath,
                line: i + 1,
                snippet: line.trim().substring(0, 120),
              });
              break;
            }
          }
        }
      }

      if (configEvidence.length === 0) return [];

      // Deduplicate by file
      const seen = new Set<string>();
      const unique = configEvidence.filter((e) => {
        if (seen.has(e.file)) return false;
        seen.add(e.file);
        return true;
      });

      return unique.map((e) => ({
        id: this.id,
        title: this.title,
        description: `Coverage configuration in ${e.file} contains broad exclude patterns that may hide untested code`,
        severity: "warning",
        category: "tests",
        evidence: [
          {
            file: e.file,
            line: e.line,
            snippet: e.snippet,
          },
        ],
        remediation: "Review and narrow coverage exclude patterns.",
        scorePenalty: PENALTY,
        docUrl: this.docUrl,
      }));
    } catch {
      return [];
    }
  },
};

export { rule };
