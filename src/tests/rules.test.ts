import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
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
      hasPackageJson: files.some((f) => f.relativePath === "package.json"),
      hasTsconfig: false,
      hasPyprojectToml: false,
      hasRequirementsTxt: false,
      hasCargoToml: false,
      hasGoMod: false,
      hasDockerfile: false,
      hasDockerCompose: false,
      hasReadme: files.some((f) => /^readme/i.test(f.relativePath)),
      hasLicense: files.some((f) => /^license/i.test(f.relativePath)),
      hasContributing: files.some((f) => /^contributing/i.test(f.relativePath)),
      hasCodeOfConduct: files.some((f) => /^code.?of.?conduct/i.test(f.relativePath)),
      hasChangelog: files.some((f) => /^changelog/i.test(f.relativePath)),
      hasCiWorkflow: false,
      hasGitignore: files.some((f) => f.relativePath === ".gitignore"),
      hasLockfile: files.some((f) =>
        /lockfile|yarn\.lock|pnpm-lock|package-lock/i.test(f.relativePath),
      ),
      hasTestDir: false,
      hasEnvExample: false,
      hasEditorConfig: false,
    },
  };
}

describe("todo-fixme rule", () => {
  it("should detect TODO markers in comments", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "// TODO: implement this\nconst x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("todo-fixme");
    expect(results[0].evidence[0].line).toBe(1);
  });

  it("should detect FIXME markers", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "// FIXME: this is broken\nconst x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should detect HACK markers", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "// HACK: workaround\nconst x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag markers outside comments", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "const TODO_LIST = [1, 2, 3];")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should cap total penalty at MAX_PENALTY", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const lines = Array.from({ length: 20 }, (_, i) => `// TODO: item ${i}`).join("\n");
    const files = [makeFile("src/index.ts", lines)];
    const results = await rule.run(makeContext(files));

    const totalPenalty = results.reduce((s, r) => s + r.scorePenalty, 0);
    expect(totalPenalty).toBeLessThanOrEqual(10);
  });

  it("should return empty for clean files", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "const x = 1;\nexport default x;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("not-implemented rule", () => {
  it("should detect 'not implemented' in throw", async () => {
    const { rule } = await import("../rules/not-implemented.js");
    const files = [makeFile("src/index.ts", 'throw new Error("not implemented");')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("not-implemented");
  });

  it("should detect return of 'not implemented' string", async () => {
    const { rule } = await import("../rules/not-implemented.js");
    const files = [makeFile("src/index.ts", 'return "not implemented";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag normal code", async () => {
    const { rule } = await import("../rules/not-implemented.js");
    const files = [makeFile("src/index.ts", 'return "hello world";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("empty-function rule", () => {
  it("should detect empty function bodies", async () => {
    const { rule } = await import("../rules/empty-function.js");
    const files = [makeFile("src/index.ts", "function foo() {}")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("empty-function");
  });

  it("should detect empty arrow function", async () => {
    const { rule } = await import("../rules/empty-function.js");
    const files = [makeFile("src/index.ts", "const foo = () => {}")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag non-empty functions", async () => {
    const { rule } = await import("../rules/empty-function.js");
    const files = [makeFile("src/index.ts", "function foo() { return 1; }")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should not confuse empty object/array with empty function", async () => {
    const { rule } = await import("../rules/empty-function.js");
    const files = [makeFile("src/index.ts", "const arr = []; const obj = {};")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("placeholder-text rule", () => {
  it("should detect lorem ipsum in strings", async () => {
    const { rule } = await import("../rules/placeholder-text.js");
    const files = [makeFile("src/index.ts", 'const text = "lorem ipsum dolor sit amet";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("placeholder-text");
  });

  it("should detect 'placeholder' in strings", async () => {
    const { rule } = await import("../rules/placeholder-text.js");
    const files = [makeFile("src/index.ts", 'const msg = "Placeholder text here";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should detect 'coming soon' in strings", async () => {
    const { rule } = await import("../rules/placeholder-text.js");
    const files = [makeFile("src/index.ts", 'const msg = "Coming Soon!";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag normal text", async () => {
    const { rule } = await import("../rules/placeholder-text.js");
    const files = [makeFile("src/index.ts", 'const msg = "Hello World";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("commented-code rule", () => {
  it("should detect commented-out code blocks (4+ lines)", async () => {
    const { rule } = await import("../rules/commented-code.js");
    const files = [
      makeFile(
        "src/index.ts",
        [
          "const active = true;",
          "// function oldFunc() {",
          "//   const x = 1;",
          "//   const y = 2;",
          "//   return x + y;",
          "// }",
          "const z = 3;",
        ].join("\n"),
      ),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("commented-code");
  });

  it("should not flag short comment blocks", async () => {
    const { rule } = await import("../rules/commented-code.js");
    const files = [
      makeFile(
        "src/index.ts",
        ["const active = true;", "// short note", "const z = 3;"].join("\n"),
      ),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should detect shell-style commented blocks", async () => {
    const { rule } = await import("../rules/commented-code.js");
    const files = [
      makeFile(
        "script.sh",
        [
          "echo hello",
          "# function oldFunc() {",
          "#   echo a",
          "#   echo b",
          "#   echo c",
          "# }",
          "echo world",
        ].join("\n"),
      ),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });
});

describe("mock-data rule", () => {
  it("should detect mock data patterns in strings", async () => {
    const { rule } = await import("../rules/mock-data.js");
    const files = [makeFile("src/index.ts", 'const user = "mock data";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("mock-data");
  });

  it("should detect password123", async () => {
    const { rule } = await import("../rules/mock-data.js");
    const files = [makeFile("src/index.ts", 'const pwd = "password123";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag normal code", async () => {
    const { rule } = await import("../rules/mock-data.js");
    const files = [makeFile("src/index.ts", 'const greeting = "hello";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("disabled-tests rule", () => {
  it("should detect describe.skip", async () => {
    const { rule } = await import("../rules/disabled-tests.js");
    const files = [makeFile("src/test.spec.ts", "describe.skip('suite', () => {});")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("disabled-tests");
  });

  it("should detect it.only", async () => {
    const { rule } = await import("../rules/disabled-tests.js");
    const files = [makeFile("src/test.spec.ts", "it.only('test', () => {});")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should detect xdescribe", async () => {
    const { rule } = await import("../rules/disabled-tests.js");
    const files = [makeFile("src/test.spec.ts", "xdescribe('suite', () => {});")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should not flag normal tests", async () => {
    const { rule } = await import("../rules/disabled-tests.js");
    const files = [makeFile("src/test.spec.ts", "it('test', () => {});")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("empty-test-files rule", () => {
  it("should detect test files with no assertions", async () => {
    const { rule } = await import("../rules/empty-test-files.js");
    const files = [makeFile("src/test.spec.ts", "import { describe } from 'vitest';\n")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("empty-test-files");
  });

  it("should detect empty test files", async () => {
    const { rule } = await import("../rules/empty-test-files.js");
    const files = [makeFile("src/test.spec.ts", "")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should pass test files with assertions", async () => {
    const { rule } = await import("../rules/empty-test-files.js");
    const files = [makeFile("src/test.spec.ts", "it('works', () => { expect(1).toBe(1); });")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should ignore non-test files", async () => {
    const { rule } = await import("../rules/empty-test-files.js");
    const files = [makeFile("src/index.ts", "")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("test-echo-command rule", () => {
  it("should detect echo with success message", async () => {
    const { rule } = await import("../rules/test-echo-command.js");
    const files = [
      makeFile("package.json", JSON.stringify({ scripts: { test: 'echo "success"' } })),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test-echo-command");
  });

  it("should detect echo 'no tests'", async () => {
    const { rule } = await import("../rules/test-echo-command.js");
    const files = [
      makeFile("package.json", JSON.stringify({ scripts: { test: "echo 'no tests configured'" } })),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should pass if test script uses a test runner", async () => {
    const { rule } = await import("../rules/test-echo-command.js");
    const files = [makeFile("package.json", JSON.stringify({ scripts: { test: "vitest run" } }))];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should return empty if no package.json", async () => {
    const { rule } = await import("../rules/test-echo-command.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("hardcoded-secrets rule", () => {
  it("should detect API keys with assignment pattern", async () => {
    const { rule } = await import("../rules/hardcoded-secrets.js");
    const files = [
      makeFile("src/config.ts", 'const apiKey = "sk-123456789012345678901234567890123456";'),
    ];
    const results = await rule.run(makeContext(files));

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect password assignments", async () => {
    const { rule } = await import("../rules/hardcoded-secrets.js");
    const files = [makeFile("src/config.ts", 'const password = "hunter2";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should redact secrets in evidence snippets", async () => {
    const { rule } = await import("../rules/hardcoded-secrets.js");
    const files = [
      makeFile("src/config.ts", 'const TOKEN = "ghp_12345678901234567890123456789012345678";'),
    ];
    const results = await rule.run(makeContext(files));

    if (results.length > 0) {
      expect(results[0].evidence[0].snippet).toContain("[REDACTED]");
    }
  });

  it("should not flag clean code", async () => {
    const { rule } = await import("../rules/hardcoded-secrets.js");
    const files = [makeFile("src/index.ts", 'const name = "john";')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("env-tracked rule", () => {
  it("should detect .env files", async () => {
    const { rule } = await import("../rules/env-tracked.js");
    const files = [makeFile(".env", "SECRET=123")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("env-tracked");
  });

  it("should detect .env.local", async () => {
    const { rule } = await import("../rules/env-tracked.js");
    const files = [makeFile(".env.local", "SECRET=123")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should allow .env.example", async () => {
    const { rule } = await import("../rules/env-tracked.js");
    const files = [makeFile(".env.example", "SECRET=123")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should return empty if no .env files", async () => {
    const { rule } = await import("../rules/env-tracked.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("unsafe-eval rule", () => {
  it("should detect eval usage", async () => {
    const { rule } = await import("../rules/unsafe-eval.js");
    const files = [makeFile("src/index.ts", "eval(code);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("unsafe-eval");
  });

  it("should detect new Function()", async () => {
    const { rule } = await import("../rules/unsafe-eval.js");
    const files = [makeFile("src/index.ts", "const fn = new Function('return 1');")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
  });

  it("should skip test files", async () => {
    const { rule } = await import("../rules/unsafe-eval.js");
    const files = [makeFile("src/index.test.ts", "eval(code);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should not flag commented eval", async () => {
    const { rule } = await import("../rules/unsafe-eval.js");
    const files = [makeFile("src/index.ts", "// eval(code);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("wildcard-cors rule", () => {
  it("should detect Access-Control-Allow-Origin set to wildcard", async () => {
    const { rule } = await import("../rules/wildcard-cors.js");
    const files = [makeFile("src/index.ts", 'res.set("Access-Control-Allow-Origin", "*")')];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("wildcard-cors");
  });

  it("should not flag specific origins", async () => {
    const { rule } = await import("../rules/wildcard-cors.js");
    const files = [
      makeFile("src/index.ts", 'res.set("Access-Control-Allow-Origin", "https://example.com");'),
    ];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("empty-catch rule", () => {
  it("should detect empty catch blocks with parameter", async () => {
    const { rule } = await import("../rules/empty-catch.js");
    const files = [makeFile("src/index.ts", "try { doStuff(); } catch(e) {}")];
    const results = await rule.run(makeContext(files));

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("empty-catch");
  });

  it("should detect catch with no parameter", async () => {
    const { rule } = await import("../rules/empty-catch.js");
    const files = [makeFile("src/index.ts", "try { doStuff(); } catch {}")];
    const results = await rule.run(makeContext(files));

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("should not flag catch with handling", async () => {
    const { rule } = await import("../rules/empty-catch.js");
    const files = [makeFile("src/index.ts", "try { doStuff(); } catch(e) { console.error(e); }")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("process-exit rule", () => {
  it("should detect process.exit in non-CLI files", async () => {
    const { rule } = await import("../rules/process-exit.js");
    const files = [makeFile("src/utils.ts", "process.exit(1);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("process-exit");
  });

  it("should skip CLI entry files", async () => {
    const { rule } = await import("../rules/process-exit.js");
    const files = [makeFile("src/cli/main.ts", "process.exit(1);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should skip test files", async () => {
    const { rule } = await import("../rules/process-exit.js");
    const files = [makeFile("src/utils.test.ts", "process.exit(1);")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });

  it("should skip non-JS/TS files", async () => {
    const { rule } = await import("../rules/process-exit.js");
    const files = [makeFile("script.py", "exit(1)")];
    const results = await rule.run(makeContext(files));

    expect(results).toHaveLength(0);
  });
});

describe("community file rules", () => {
  it("readme-exists: should detect missing README", async () => {
    const { rule } = await import("../rules/readme-exists.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("readme-exists");
  });

  it("readme-exists: should pass when README exists", async () => {
    const { rule } = await import("../rules/readme-exists.js");
    const files = [makeFile("README.md", "# Project")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });

  it("license-exists: should detect missing LICENSE", async () => {
    const { rule } = await import("../rules/license-exists.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("license-exists");
  });

  it("license-exists: should pass when LICENSE exists", async () => {
    const { rule } = await import("../rules/license-exists.js");
    const files = [makeFile("LICENSE", "MIT")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });

  it("contributing-exists: should detect missing CONTRIBUTING", async () => {
    const { rule } = await import("../rules/contributing-exists.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("contributing-exists");
  });

  it("contributing-exists: should pass when CONTRIBUTING exists", async () => {
    const { rule } = await import("../rules/contributing-exists.js");
    const files = [makeFile("CONTRIBUTING.md", "# Contributing")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });

  it("code-of-conduct: should detect missing CODE_OF_CONDUCT", async () => {
    const { rule } = await import("../rules/code-of-conduct.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("code-of-conduct");
  });

  it("code-of-conduct: should pass when CODE_OF_CONDUCT exists", async () => {
    const { rule } = await import("../rules/code-of-conduct.js");
    const files = [makeFile("CODE_OF_CONDUCT.md", "# Code of Conduct")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });

  it("changelog-exists: should detect missing CHANGELOG", async () => {
    const { rule } = await import("../rules/changelog-exists.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("changelog-exists");
  });

  it("changelog-exists: should pass when CHANGELOG exists", async () => {
    const { rule } = await import("../rules/changelog-exists.js");
    const files = [makeFile("CHANGELOG.md", "# Changelog")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });

  it("ci-workflow: should detect missing CI workflow", async () => {
    const { rule } = await import("../rules/ci-workflow.js");
    const files = [makeFile("src/index.ts", "const x = 1;")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ci-workflow");
  });

  it("lockfile-exists: should detect missing lockfile for JS project", async () => {
    const { rule } = await import("../rules/lockfile-exists.js");
    const files = [makeFile("package.json", '{ "name": "test" }')];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("lockfile-exists");
  });

  it("lockfile-exists: should pass when lockfile exists", async () => {
    const { rule } = await import("../rules/lockfile-exists.js");
    const files = [
      makeFile("package.json", '{ "name": "test" }'),
      makeFile("package-lock.json", "{}"),
    ];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });
});

describe("rule edge cases", () => {
  it("should handle empty file list", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const results = await rule.run(makeContext([]));
    expect(results).toHaveLength(0);
  });

  it("should handle empty file content", async () => {
    const { rule } = await import("../rules/todo-fixme.js");
    const files = [makeFile("src/index.ts", "")];
    const results = await rule.run(makeContext(files));
    expect(results).toHaveLength(0);
  });
});
