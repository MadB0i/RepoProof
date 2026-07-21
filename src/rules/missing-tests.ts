import { Rule, RuleResult, ScanContext } from "../types.js";

const TEST_FILE_EXTS = [".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.js", ".spec.tsx"];
const SOURCE_EXTS = [".ts", ".tsx", ".js", ".jsx"];
const EXCLUDED_FILES = [
  /^index\.(ts|tsx|js|jsx)$/,
  /\.config\.(ts|js)$/,
  /config\.(ts|js)$/i,
  /\.d\.ts$/,
  /\.d\.tsx$/,
  /^vite\.config\./,
  /^jest\.config\./,
  /^webpack\.config\./,
  /^rollup\.config\./,
  /^eslint\.config\./,
  /^prettier\.config\./,
  /^tailwind\.config\./,
  /^next\.config\./,
  /^nuxt\.config\./,
  /^vitest\.config\./,
  /^playwright\.config\./,
  /\.typegen\./,
];

const MAX_PENALTY = 10;
const PENALTY = 3;

function hasCorrespondingTest(sourceRelativePath: string, testFiles: Set<string>): boolean {
  const dotIndex = sourceRelativePath.lastIndexOf(".");
  const baseName = sourceRelativePath.substring(0, dotIndex);

  for (const ext of TEST_FILE_EXTS) {
    if (testFiles.has(`${baseName}${ext}`)) return true;
    // Also check with __tests__ directory pattern
    const parts = sourceRelativePath.split("/");
    const fileName = parts[parts.length - 1];
    const testFileName = fileName.substring(0, fileName.lastIndexOf(".")) + ext;
    const dir = parts.slice(0, -1).join("/");
    if (testFiles.has(`${dir}/__tests__/${testFileName}`)) return true;
    if (testFiles.has(`${dir}/test/${testFileName}`)) return true;
    if (testFiles.has(`${dir}/tests/${testFileName}`)) return true;
  }

  return false;
}

function isExcludedFile(relativePath: string): boolean {
  const fileName = relativePath.split("/").pop() || relativePath;
  for (const pattern of EXCLUDED_FILES) {
    if (pattern.test(fileName)) return true;
  }
  // Exclude test files themselves
  for (const ext of TEST_FILE_EXTS) {
    if (relativePath.endsWith(ext)) return true;
  }
  return false;
}

const rule: Rule = {
  id: "missing-tests",
  title: "Missing test files for source files",
  description:
    "Detects source files that do not have corresponding test files, indicating incomplete test coverage.",
  severity: "warning",
  category: "tests",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/missing-tests",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      // Build set of all test file paths
      const testFiles = new Set<string>();
      const sourceFiles: string[] = [];

      for (const file of context.files) {
        const rp = file.relativePath;
        let isTest = false;
        for (const ext of TEST_FILE_EXTS) {
          if (rp.endsWith(ext)) {
            testFiles.add(rp);
            isTest = true;
            break;
          }
        }
        if (!isTest) {
          for (const ext of SOURCE_EXTS) {
            if (rp.endsWith(ext)) {
              sourceFiles.push(rp);
              break;
            }
          }
        }
      }

      // Find source files without corresponding tests
      const missing: string[] = [];
      for (const src of sourceFiles) {
        if (isExcludedFile(src)) continue;
        if (!hasCorrespondingTest(src, testFiles)) {
          missing.push(src);
        }
      }

      if (missing.length === 0) return [];

      const totalPenalty = Math.min(missing.length * PENALTY, MAX_PENALTY);

      // Group by directory for a cleaner report
      const byDir = new Map<string, string[]>();
      for (const m of missing) {
        const dir = m.includes("/") ? m.substring(0, m.lastIndexOf("/")) : ".";
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir)!.push(m);
      }

      const groups: Array<{ dir: string; files: string[] }> = [];
      for (const [dir, files] of byDir) {
        groups.push({ dir, files });
      }
      groups.sort((a, b) => a.dir.localeCompare(b.dir));

      const findings: RuleResult[] = [];
      for (const group of groups) {
        if (totalPenalty > 0 && findings.reduce((s, r) => s + r.scorePenalty, 0) >= MAX_PENALTY)
          break;

        findings.push({
          id: this.id,
          title: this.title,
          description: `Missing test files for ${group.files.length} source file(s) in ${group.dir}`,
          severity: "warning",
          category: "tests",
          evidence: group.files.map((f) => ({
            file: f,
          })),
          remediation: `Add test files for: ${group.files.join(", ")}`,
          scorePenalty: Math.min(PENALTY * group.files.length, MAX_PENALTY),
          docUrl: this.docUrl,
        });
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
