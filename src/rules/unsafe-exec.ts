import { Rule, RuleResult, ScanContext, SOURCE_CODE_EXTENSIONS } from "../types.js";

// Conservative, clear-signal-only patterns: the exec/spawn call sites that
// run external commands. `execFile`/`execFileSync` are deliberately NOT
// matched — their args-array API is the safe alternative we recommend, so
// flagging it would punish the fix.
//
// Known regex limits (documented, not hidden): matching is textual, not an
// AST. A static-argument call such as spawn("ls", ["-l"]) still flags, and
// an inline trailing comment mentioning exec(...) can false-positive. Only
// full-line comments are skipped, mirroring unsafe-eval.
const DANGEROUS_PATTERNS = [
  /\bexec\s*\(/g,
  /\bexecSync\s*\(/g,
  /\bspawn\s*\(/g,
  /\bspawnSync\s*\(/g,
];

const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
  /\/test-utils\//,
];

const MAX_PENALTY = 15;
const PENALTY_PER_FINDING = 5;

const rule: Rule = {
  id: "unsafe-exec",
  title: "Use of child_process exec/spawn",
  description:
    "Detects child_process exec(), execSync(), spawn(), and spawnSync() calls, which can lead to command injection when commands include untrusted input. Regex-based: static-argument calls may flag, and execFile()/execFileSync() (the safer args-array API) are not covered.",
  severity: "error",
  category: "security-configuration",
  scorePenalty: PENALTY_PER_FINDING,
  docUrl: "https://repoproof.dev/docs/rules/unsafe-exec",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;
      const MAX_FINDINGS = Math.ceil(MAX_PENALTY / PENALTY_PER_FINDING);

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;
        const ext = file.relativePath.substring(file.relativePath.lastIndexOf("."));
        if (!SOURCE_CODE_EXTENSIONS.has(ext)) continue;

        // Skip test files
        const isTestFile = TEST_FILE_PATTERNS.some((p) => p.test(file.relativePath));
        if (isTestFile) continue;

        for (const pattern of DANGEROUS_PATTERNS) {
          if (totalPenalty >= MAX_PENALTY) break;

          const matches = file.content.matchAll(pattern);
          for (const m of matches) {
            if (totalPenalty >= MAX_PENALTY) break;
            if (findings.length >= MAX_FINDINGS) break;

            const lineNo = file.content.substring(0, m.index).split("\n").length;
            const snippet = file.content.split("\n")[lineNo - 1]?.trim().substring(0, 120);

            // Skip if it's in a comment
            const line = file.content.split("\n")[lineNo - 1] || "";
            if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

            findings.push({
              id: this.id,
              title: this.title,
              description: `Use of ${m[0].trim()} detected`,
              severity: "error",
              category: "security-configuration",
              evidence: [
                {
                  file: file.relativePath,
                  line: lineNo,
                  snippet: snippet || m[0].trim(),
                },
              ],
              remediation:
                "Avoid shell execution with untrusted input; prefer execFile with an args array and validate inputs.",
              scorePenalty: PENALTY_PER_FINDING,
              docUrl: this.docUrl,
            });
            totalPenalty += PENALTY_PER_FINDING;
          }
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
