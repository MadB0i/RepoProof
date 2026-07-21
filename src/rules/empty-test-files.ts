import { Rule, RuleResult, ScanContext } from "../types.js";

const TEST_EXTS = [
  ".test.ts",
  ".test.tsx",
  ".test.js",
  ".test.mjs",
  ".spec.ts",
  ".spec.tsx",
  ".spec.js",
  ".spec.mjs",
];

const ASSERTION_PATTERNS = [
  /\bexpect\s*\(/,
  /\bassert\b/,
  /\bshould\b/,
  /\bjest\./,
  /\bdescribe\s*\(/,
  /\bit\s*\(/,
  /\btest\s*\(/,
  /\bvi\.\w+\s*\(/,
  /\bassert\./,
  /\bstrictEqual\b/,
  /\bdeepEqual\b/,
  /\bnotEqual\b/,
  /\btoBe\b/,
  /\btoEqual\b/,
  /\btoMatch\b/,
  /\btoContain\b/,
  /\btoThrow\b/,
  /\btoHaveLength\b/,
  /\btoHaveProperty\b/,
  /\btoHaveBeenCalled\b/,
  /\btoHaveReturned\b/,
  /\bresolves\b/,
  /\brejects\b/,
];

const MAX_PENALTY = 12;
const PENALTY_PER_FILE = 4;

function hasAssertions(content: string): boolean {
  return ASSERTION_PATTERNS.some((p) => p.test(content));
}

function isEmptyContent(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) return true;
  // Only imports and whitespace
  const noImports = trimmed.replace(/^import\s+.*?;?\s*$/gm, "").trim();
  return noImports.length === 0;
}

const rule: Rule = {
  id: "empty-test-files",
  title: "Empty test files or tests without assertions",
  description:
    "Detects test files that are empty or contain no assertion calls, indicating incomplete or placeholder tests.",
  severity: "warning",
  category: "tests",
  scorePenalty: PENALTY_PER_FILE,
  docUrl: "https://repoproof.dev/docs/rules/empty-test-files",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        const isTestFile = TEST_EXTS.some((ext) => file.relativePath.endsWith(ext));
        if (!isTestFile) continue;

        if (isEmptyContent(file.content)) {
          findings.push({
            id: this.id,
            title: this.title,
            description: "Empty test file with no content",
            severity: "warning",
            category: "tests",
            evidence: [
              {
                file: file.relativePath,
              },
            ],
            remediation: "Remove empty test file or implement tests.",
            scorePenalty: PENALTY_PER_FILE,
            docUrl: this.docUrl,
          });
          totalPenalty += PENALTY_PER_FILE;
          continue;
        }

        if (!hasAssertions(file.content)) {
          findings.push({
            id: this.id,
            title: this.title,
            description: "Test file with no assertions or test blocks",
            severity: "warning",
            category: "tests",
            evidence: [
              {
                file: file.relativePath,
              },
            ],
            remediation: "Add assertions or test blocks to this file.",
            scorePenalty: PENALTY_PER_FILE,
            docUrl: this.docUrl,
          });
          totalPenalty += PENALTY_PER_FILE;
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
