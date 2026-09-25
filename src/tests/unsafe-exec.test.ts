import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { rule } from "../rules/unsafe-exec.js";
import { calculateScore } from "../engine/rule-runner.js";
import type { ScannedFile, ScanContext, RepoProofConfig } from "../types.js";

const normalizeMockPath = (p: string): string => resolve(p).replace(/\\/g, "/");
const TEST_ROOT = normalizeMockPath("virtual-test-repo");

function makeFile(relativePath: string, content: string): ScannedFile {
  return {
    path: join(TEST_ROOT, relativePath),
    relativePath,
    content,
    size: Buffer.byteLength(content, "utf-8"),
  };
}

function makeContext(
  files: ScannedFile[],
  configOverrides?: Partial<RepoProofConfig>,
): ScanContext {
  const config: RepoProofConfig = {
    minScore: 70,
    maxFileSize: 1048576,
    failOn: "error",
    ...configOverrides,
  };
  return {
    files,
    config,
    projectType: {
      languages: [],
      hasPackageJson: false,
      hasTsconfig: false,
      hasPyprojectToml: false,
      hasRequirementsTxt: false,
      hasCargoToml: false,
      hasGoMod: false,
      hasDockerfile: false,
      hasDockerCompose: false,
      hasReadme: false,
      hasLicense: false,
      hasContributing: false,
      hasCodeOfConduct: false,
      hasChangelog: false,
      hasCiWorkflow: false,
      hasGitignore: false,
      hasLockfile: false,
      hasTestDir: false,
      hasEnvExample: false,
      hasEditorConfig: false,
    },
  };
}

describe("unsafe-exec rule metadata", () => {
  it("should live in the existing security-configuration category (no score-math change)", () => {
    expect(rule.id).toBe("unsafe-exec");
    expect(rule.severity).toBe("error");
    expect(rule.category).toBe("security-configuration");
    expect(rule.scorePenalty).toBe(5);
  });
});

describe("unsafe-exec true positives", () => {
  it("should detect exec() with interpolated command", async () => {
    const files = [
      makeFile("src/run.ts", 'import { exec } from "child_process";\nexec("ls " + userInput);'),
    ];
    const results = await rule.run(makeContext(files));

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("unsafe-exec");
    expect(results[0].evidence[0].line).toBe(2);
  });

  it("should detect execSync()", async () => {
    const files = [makeFile("src/run.ts", "const out = execSync(cmd);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should detect spawn() and spawnSync()", async () => {
    const files = [
      makeFile("src/a.ts", 'spawn("sh", ["-c", cmd]);'),
      makeFile("src/b.ts", 'spawnSync("deploy");'),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(2);
  });

  it('should detect require("child_process").exec call sites', async () => {
    const files = [makeFile("src/run.js", 'require("child_process").exec("rm -rf " + dir);')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });
});

describe("unsafe-exec false positives", () => {
  it("should not flag full-line comments mentioning exec", async () => {
    const files = [makeFile("src/run.ts", "// use exec here for deploys\nconst x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should skip test files", async () => {
    const files = [makeFile("src/run.test.ts", 'exec("ls");')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should skip non-source extensions", async () => {
    const files = [makeFile("notes.md", "exec(foo) in docs")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should not match the word 'execution('", async () => {
    const files = [makeFile("src/run.ts", "execution(plan);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should not flag execFile (the safe args-array API)", async () => {
    const files = [makeFile("src/run.ts", 'execFile("/bin/ls", ["-l"], cb);')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should not flag clean code", async () => {
    const files = [makeFile("src/run.ts", "const x = 1;\nexport default x;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("unsafe-exec limits and integration", () => {
  it("should cap total penalty at MAX_PENALTY", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `exec("cmd${i}");`).join("\n");
    const files = [makeFile("src/run.ts", lines)];
    const results = await rule.run(makeContext(files));

    const totalPenalty = results.reduce((s, r) => s + r.scorePenalty, 0);
    expect(totalPenalty).toBeLessThanOrEqual(15);
  });

  it("should deduct from the security-configuration category score", async () => {
    const files = [makeFile("src/run.ts", 'exec("ls " + userInput);')];
    const results = await rule.run(makeContext(files));
    expect(results.length).toBeGreaterThanOrEqual(1);

    const { score, categoryScores } = calculateScore(results);
    expect(categoryScores["security-configuration"].score).toBeLessThan(30);
    expect(score).toBeLessThan(100);
  });

  it("should handle empty file list and empty content", async () => {
    expect(await rule.run(makeContext([]))).toHaveLength(0);
    expect(await rule.run(makeContext([makeFile("src/run.ts", "")]))).toHaveLength(0);
  });
});
