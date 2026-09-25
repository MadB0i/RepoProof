import { describe, it, expect, afterEach } from "vitest";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { Server, get } from "node:http";

function httpGetText(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolvePromise({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString() }),
      );
    }).on("error", rejectPromise);
  });
}
import {
  parseGitHubTarget,
  friendlyCloneError,
  renderDashboard,
  renderErrorPage,
  withWebChrome,
  formatDeltaBanner,
  handleLocalScan,
  handleGithubScan,
  routeRequest,
  startServer,
  openBrowser,
  LOOPBACK_HOST,
  DEFAULT_PORT,
  type CloneRunner,
} from "../web/server.js";
import type { ScanReport } from "../types.js";

const servers: Server[] = [];
afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
});

function makeReport(overrides?: Partial<ScanReport>): ScanReport {
  return {
    version: "1.0.0",
    timestamp: "2026-01-01T00:00:00.000Z",
    score: 78,
    grade: "C",
    maxScore: 100,
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
    categoryScores: {
      "incomplete-implementation": { score: 20, maxScore: 20, findings: 0 },
      tests: { score: 20, maxScore: 20, findings: 0 },
      "security-configuration": { score: 30, maxScore: 30, findings: 0 },
      "error-handling-reliability": { score: 15, maxScore: 15, findings: 0 },
      "repository-readiness": { score: 15, maxScore: 15, findings: 0 },
    },
    findings: [],
    config: {},
    summary: { totalFindings: 0, errors: 0, warnings: 0, info: 0, passedChecks: 31 },
    ...overrides,
  };
}

describe("parseGitHubTarget", () => {
  it("should accept owner/repo shorthand", () => {
    expect(parseGitHubTarget("octocat/hello-world")).toEqual({
      owner: "octocat",
      repo: "hello-world",
      cloneUrl: "https://github.com/octocat/hello-world.git",
    });
  });

  it("should accept full https URLs with optional .git and trailing slash", () => {
    expect(parseGitHubTarget("https://github.com/octocat/hello-world")).toMatchObject({
      owner: "octocat",
      repo: "hello-world",
    });
    expect(parseGitHubTarget("https://github.com/octocat/hello-world.git")).toMatchObject({
      cloneUrl: "https://github.com/octocat/hello-world.git",
    });
    expect(parseGitHubTarget("https://github.com/octocat/hello-world/")).toMatchObject({
      repo: "hello-world",
    });
  });

  it("should reject other hosts, schemes, and local paths", () => {
    expect(parseGitHubTarget("")).toBeNull();
    expect(parseGitHubTarget("   ")).toBeNull();
    expect(parseGitHubTarget("https://gitlab.com/a/b")).toBeNull();
    expect(parseGitHubTarget("https://evil-github.com/a/b")).toBeNull();
    expect(parseGitHubTarget("git@github.com:a/b.git")).toBeNull();
    expect(parseGitHubTarget("/abs/path/repo")).toBeNull();
    expect(parseGitHubTarget("C:\\Projects\\repo")).toBeNull();
    expect(parseGitHubTarget("just-a-name")).toBeNull();
    expect(parseGitHubTarget("a/b/c")).toBeNull();
    expect(parseGitHubTarget("../escape")).toBeNull();
  });
});

describe("friendlyCloneError", () => {
  it("should map common failures to user-readable messages", () => {
    expect(friendlyCloneError("git is not installed or not on PATH.")).toContain("not installed");
    expect(friendlyCloneError("git clone failed (exit 128). Repository not found.")).toContain(
      "Only public",
    );
    expect(friendlyCloneError("Authentication failed for 'https://..'")).toContain(
      "Private repositories are not supported",
    );
    expect(friendlyCloneError("Could not resolve host: github.com")).toContain("Network error");
  });
});

describe("dashboard and error pages", () => {
  it("should render local + github forms, spinner, and localhost notice", () => {
    const html = renderDashboard();
    expect(html).toContain('name="mode" value="local"');
    expect(html).toContain('name="mode" value="github"');
    expect(html).toContain('id="scanState"');
    expect(html).toContain('class="scan-line"');
    expect(html).toContain("SCAN IN PROGRESS");
    expect(html).toContain("127.0.0.1");
  });

  it("should use the same diagnostic-console tokens and persisted theme controls", () => {
    const html = renderDashboard();
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("--color-bg: #14161C");
    expect(html).toContain("--color-accent: #00D9C0");
    expect(html).toContain('id="themeToggle"');
    expect(html).toContain('getItem("repoproof-theme")');
    expect(html).toContain('setItem("repoproof-theme"');
    expect(html).toContain("INPUT / LOCAL");
    expect(html).toContain("INPUT / GITHUB");
    expect(html).toContain("@keyframes scanSweep");
    expect(html).toContain("animation: scanSweep 1.1s ease-in-out infinite");
  });

  it("should escape messages in error pages", () => {
    const html = renderErrorPage(400, '<script>alert("x")</script>');
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="/"');
  });
});

describe("withWebChrome", () => {
  it("should inject back bar without altering reporter markup", () => {
    const inner = "<html><body><div>REPORT</div></body></html>";
    const out = withWebChrome(inner, { sourceLabel: "my proj & co" });
    expect(out).toContain("<div>REPORT</div>");
    expect(out).toContain("&larr; New scan");
    expect(out).toContain("my proj &amp; co");
    expect(out.indexOf("<div>REPORT</div>")).toBeLessThan(out.indexOf("webnav"));
  });

  it("should include the delta banner when provided", () => {
    const out = withWebChrome("<html><body>x</body></html>", {
      sourceLabel: "s",
      deltaText: "78.0 (+5.0 vs last run)",
    });
    expect(out).toContain("78.0 (+5.0 vs last run)");
  });

  it("should format delta banners", () => {
    expect(formatDeltaBanner(makeReport({ score: 78 }), 73)).toBe("78.0 (+5.0 vs last run)");
    expect(formatDeltaBanner(makeReport({ score: 70 }), 73)).toContain("3.0 vs last run");
  });
});

describe("handleLocalScan", () => {
  it("should reject empty paths with a readable 400", async () => {
    const result = await handleLocalScan("   ", { recordHistory: false });
    expect(result.status).toBe(400);
    expect(result.body).toContain("Enter a local folder path");
  });

  it("should return 400 (not crash) for a missing path", async () => {
    const result = await handleLocalScan("no-such-dir-xyz", { recordHistory: false });
    expect(result.status).toBe(400);
    expect(result.body).toContain("Path not found");
  });

  it("should scan a valid folder and return report HTML", async () => {
    const result = await handleLocalScan(resolve("src/good-fixture"), { recordHistory: false });
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/html");
    expect(result.body).toContain("score-ring");
    expect(result.body).toContain("New scan");
  });
});

describe("handleGithubScan", () => {
  it("should reject invalid input with a readable 400", async () => {
    const result = await handleGithubScan("https://gitlab.com/a/b");
    expect(result.status).toBe(400);
    expect(result.body).toContain("owner/name");
  });

  it("should scan a mock-cloned repo and clean up the temp dir", async () => {
    let destDir = "";
    const runner: CloneRunner = async (args, _options) => {
      destDir = args[args.length - 1];
      mkdirSync(destDir, { recursive: true });
      writeFileSync(`${destDir}/index.ts`, "export const x = 1;\n");
    };

    const result = await handleGithubScan("octocat/hello-world", { cloneRunner: runner });
    expect(result.status).toBe(200);
    expect(result.body).toContain("octocat/hello-world");
    expect(result.body).toContain("deleted after scan");
    // Temp clone must be gone.
    expect(destDir).not.toBe("");
    expect(existsSync(dirname(destDir))).toBe(false);
  });

  it("should return a readable error when cloning fails (and still clean up)", async () => {
    let destDir = "";
    const runner: CloneRunner = async (args, _options) => {
      destDir = args[args.length - 1];
      mkdirSync(destDir, { recursive: true });
      throw new Error("git clone failed (exit 128). Repository not found.");
    };

    const result = await handleGithubScan("octocat/nope", { cloneRunner: runner });
    expect(result.status).toBe(502);
    expect(result.body).toContain("Only public");
    expect(existsSync(dirname(destDir))).toBe(false);
  });

  it("should surface git-missing errors readably", async () => {
    const runner: CloneRunner = async () => {
      throw new Error("git is not installed or not on PATH.");
    };
    const result = await handleGithubScan("octocat/hello-world", { cloneRunner: runner });
    expect(result.status).toBe(502);
    expect(result.body).toContain("not installed");
  });
});

describe("routing", () => {
  it("should serve the dashboard at /", async () => {
    const result = await routeRequest("GET", "/");
    expect(result.status).toBe(200);
    expect(result.body).toContain("Web Dashboard");
  });

  it("should route /scan to local and github handlers", async () => {
    const bad = await routeRequest("GET", "/scan?mode=local&target=no-such-dir-xyz", {
      recordHistory: false,
    });
    expect(bad.status).toBe(400);

    const badGh = await routeRequest("GET", "/scan?mode=github&target=bogus");
    expect(badGh.status).toBe(400);
  });

  it("should 404 unknown paths", async () => {
    const result = await routeRequest("GET", "/nope");
    expect(result.status).toBe(404);
  });
});

describe("openBrowser", () => {
  it("should map platform openers without throwing", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fakeSpawn = (command: string, args: string[], _options: object) => {
      calls.push({ command, args });
      return { unref: () => undefined };
    };

    await openBrowser("http://127.0.0.1:4321", { platform: "win32", spawnFn: fakeSpawn });
    expect(calls[0].command).toBe("cmd");
    expect(calls[0].args).toContain("http://127.0.0.1:4321");

    calls.length = 0;
    await openBrowser("http://127.0.0.1:4321", { platform: "darwin", spawnFn: fakeSpawn });
    expect(calls[0].command).toBe("open");

    calls.length = 0;
    await openBrowser("http://127.0.0.1:4321", { platform: "linux", spawnFn: fakeSpawn });
    expect(calls[0].command).toBe("xdg-open");
  });

  it("should return false when spawning fails", async () => {
    const boom = () => {
      throw new Error("nope");
    };
    expect(await openBrowser("http://127.0.0.1:4321", { platform: "linux", spawnFn: boom })).toBe(
      false,
    );
  });
});

describe("server binding (localhost-only)", () => {
  it("should listen on 127.0.0.1 and serve the dashboard", async () => {
    const { server, url } = await startServer(0);
    servers.push(server);
    expect(DEFAULT_PORT).toBe(4321);

    const address = server.address();
    expect(address).not.toBeNull();
    if (typeof address === "object" && address !== null) {
      expect(address.address).toBe(LOOPBACK_HOST);
    }

    const res = await httpGetText(`${url}/`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Web Dashboard");

    const scan = await httpGetText(`${url}/scan?mode=local&target=no-such-dir-xyz`);
    expect(scan.status).toBe(400);
  });

  it("should reject invalid ports", async () => {
    await expect(startServer(0.5)).rejects.toThrow("Invalid port");
    await expect(startServer(99999)).rejects.toThrow("Invalid port");
  });
});
