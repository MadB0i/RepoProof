import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { execFile, spawn, SpawnOptions } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performScan } from "../engine/scan.js";
import { generateHtmlReport } from "../reporters/html-reporter.js";
import { readHistory, appendHistory, resolveBaseline } from "../history/history.js";
import { ScanReport } from "../types.js";

/** Non-negotiable: the server only ever binds to loopback. */
export const LOOPBACK_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4321;

export interface GitHubTarget {
  owner: string;
  repo: string;
  cloneUrl: string;
}

/**
 * Accept `owner/repo` shorthand or `https://github.com/owner/repo`
 * (optional `.git` suffix / trailing slash). Anything else — other hosts,
 * schemes, absolute/relative local paths — returns null.
 */
export function parseGitHubTarget(input: string): GitHubTarget | null {
  const trimmed = (input ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const full = trimmed.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(\.git)?$/i);
  if (full) {
    const owner = full[1];
    const repo = full[2];
    return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git` };
  }

  // Shorthand must be exactly `owner/repo` — reject URLs, absolute paths,
  // Windows drive paths, and dot segments.
  if (trimmed.includes("://") || trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)) {
    return null;
  }
  const short = trimmed.match(/^([^/\s@:?#]+)\/([^/\s@:?#]+?)(\.git)?$/);
  if (!short) return null;
  const [owner, repo] = [short[1], short[2]];
  if (owner === "." || owner === ".." || repo === "." || repo === "..") return null;
  return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git` };
}

export type CloneRunner = (args: string[], options: { cwd: string }) => Promise<void>;

function gitErrorWithStderr(message: string): Error {
  return new Error(message);
}

export function defaultCloneRunner(args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile("git", args, { cwd: options.cwd }, (error, _stdout, stderr) => {
      if (!error) {
        resolvePromise();
        return;
      }
      const detail = (stderr ?? "").trim().split("\n").slice(0, 3).join(" ").slice(0, 300);
      if (/ENOENT/i.test(error.message)) {
        rejectPromise(gitErrorWithStderr("git is not installed or not on PATH."));
      } else {
        rejectPromise(
          gitErrorWithStderr(
            `git clone failed (exit ${(error as { code?: unknown }).code ?? "?"}).${detail ? ` ${detail}` : ""}`,
          ),
        );
      }
    });
  });
}

export async function cloneShallowRepo(
  cloneUrl: string,
  destDir: string,
  runner: CloneRunner = defaultCloneRunner,
): Promise<void> {
  await runner(["clone", "--depth", "1", cloneUrl, destDir], { cwd: tmpdir() });
}

export function friendlyCloneError(message: string): string {
  if (/not installed or not on PATH/i.test(message)) return message;
  if (/Repository not found/i.test(message)) {
    return "Repository not found. Only public repositories can be cloned.";
  }
  if (/Authentication failed/i.test(message)) {
    return "Authentication failed. Private repositories are not supported — use a public repository.";
  }
  if (/Could not resolve host|unable to connect|Network is unreachable|Timeout/i.test(message)) {
    return `Network error while cloning. Check your connection. (${message.slice(0, 200)})`;
  }
  return message.slice(0, 300);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RepoProof — Web Dashboard</title>
<style>
  :root {
    --color-bg: #14161C;
    --color-surface: #1B1E27;
    --color-surface-strong: #20232D;
    --color-border: #2A2E3A;
    --color-text: #E8EAF0;
    --color-text-secondary: #8B90A3;
    --color-accent: #00D9C0;
    --color-fail: #FF5D5D;
    --radius: 3px;
    --font-family: "IBM Plex Sans", "Trebuchet MS", sans-serif;
    --font-display: "Space Grotesk", "Trebuchet MS", sans-serif;
    --font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  }
  [data-theme="light"] {
    --color-bg: #F4F6F8;
    --color-surface: #FFFFFF;
    --color-surface-strong: #EEF1F4;
    --color-border: #D6DCE3;
    --color-text: #171B22;
    --color-text-secondary: #5C6675;
    --color-accent: #007F78;
    --color-fail: #C53D4B;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-family); background: var(--color-bg); color: var(--color-text); line-height: 1.5; }
  .container { max-width: 1180px; margin: 0; padding: 28px 32px; }
  header { display: flex; justify-content: space-between; gap: 20px; padding: 0 0 18px; border-bottom: 1px solid var(--color-border); margin-bottom: 24px; }
  header h1 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
  header p { color: var(--color-text-secondary); font-size: 0.8125rem; margin-top: 4px; }
  .theme-toggle { align-self: flex-start; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-accent); padding: 7px 12px; border-radius: var(--radius); cursor: pointer; font-family: var(--font-mono); font-size: 0.75rem; }
  .theme-toggle:hover { border-color: var(--color-accent); }
  .instrument { display: grid; grid-template-columns: 150px 1fr; gap: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-left: 3px solid var(--color-accent); padding: 18px 20px; margin-bottom: 14px; }
  .instrument-label { font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-accent); letter-spacing: 0.08em; }
  .instrument h2 { font-family: var(--font-display); font-size: 1rem; font-weight: 600; margin: 4px 0 6px; }
  .instrument p { color: var(--color-text-secondary); font-size: 0.8125rem; margin-bottom: 12px; }
  form { display: flex; gap: 8px; flex-wrap: wrap; }
  input[type="text"] { flex: 1; min-width: 220px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-mono); font-size: 0.75rem; }
  input[type="text"]:focus { outline: 1px solid var(--color-accent); outline-offset: 1px; }
  button[type="submit"] { padding: 8px 14px; border: 1px solid var(--color-accent); border-radius: 0; background: var(--color-accent); color: var(--color-bg); font-family: var(--font-mono); font-size: 0.75rem; cursor: pointer; }
  button[type="submit"]:hover { background: transparent; color: var(--color-accent); }
  .notice { font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-text-secondary); border-top: 1px solid var(--color-border); padding-top: 16px; margin-top: 24px; }
  #scanState { display: none; padding: 18px 20px; border: 1px solid var(--color-border); border-left: 3px solid var(--color-accent); }
  .scan-track { position: relative; height: 22px; overflow: hidden; background: var(--color-bg); border: 1px solid var(--color-border); }
  .scan-line { position: absolute; top: 3px; bottom: 3px; width: 28%; background: var(--color-accent); box-shadow: 0 0 12px var(--color-accent); animation: scanSweep 1.1s ease-in-out infinite; }
  .scan-status { margin-top: 10px; font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-accent); }
  @keyframes scanSweep { 0% { left: -30%; opacity: 0.4; } 50% { opacity: 1; } 100% { left: 102%; opacity: 0.4; } }
</style>
</head>
<body>
<div class="container">
  <header>
    <div>
      <h1>RepoProof <span style="color:var(--color-accent)">/</span> Diagnostic Console</h1>
      <p>Local-first repository quality audit. Scans run on this machine only.</p>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle color mode" aria-pressed="true"><span id="themeIcon">☀</span> <span id="themeLabel">Light</span></button>
  </header>

  <section class="instrument" id="localCard">
    <div class="instrument-label">INPUT / LOCAL</div>
    <div>
      <h2>Scan a local folder</h2>
      <p>Already-cloned repository or project directory. No cloning involved.</p>
    <form id="localForm" action="/scan" method="get">
      <input type="hidden" name="mode" value="local">
      <input type="text" name="target" placeholder="e.g. D:\\Projects\\my-app or ." aria-label="Local folder path">
      <button type="submit">Scan folder</button>
    </form>
    </div>
  </section>

  <section class="instrument" id="githubCard">
    <div class="instrument-label">INPUT / GITHUB</div>
    <div>
      <h2>Scan a public GitHub repository</h2>
      <p>Shallow-cloned (<code>git clone --depth 1</code>) into the OS temp dir, scanned, then deleted. No cache is kept. Private repositories are not supported.</p>
    <form id="githubForm" action="/scan" method="get">
      <input type="hidden" name="mode" value="github">
      <input type="text" name="target" placeholder="e.g. owner/repo or https://github.com/owner/repo" aria-label="GitHub repository">
      <button type="submit">Clone &amp; scan</button>
    </form>
    </div>
  </section>

  <div id="scanState" role="status" aria-live="polite">
    <div class="scan-track" aria-hidden="true"><span class="scan-line"></span></div>
    <div class="scan-status">SCAN IN PROGRESS&hellip;</div>
  </div>

  <p class="notice">SERVER 127.0.0.1 / LOOPBACK ONLY &middot; network access limited to requested public git clones.</p>
</div>

<script>
(function() {
  var storage = null;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  function readTheme() {
    try {
      var stored = storage && storage.getItem("repoproof-theme");
      return stored === "light" || stored === "dark" ? stored : "dark";
    } catch (error) { return "dark"; }
  }
  function saveTheme(theme) {
    try { if (storage) storage.setItem("repoproof-theme", theme); } catch (error) { void error; }
  }
  function updateThemeUI(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var toggle = document.getElementById("themeToggle");
    if (toggle) toggle.setAttribute("aria-pressed", String(theme === "dark"));
    var icon = document.getElementById("themeIcon");
    var label = document.getElementById("themeLabel");
    if (icon) icon.textContent = theme === "dark" ? "☀" : "◐";
    if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
  }
  updateThemeUI(readTheme());
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", function() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    saveTheme(next);
    updateThemeUI(next);
  });
  function onSubmit() {
    var scanState = document.getElementById("scanState");
    if (scanState) scanState.style.display = "block";
  }
  document.getElementById("localForm").addEventListener("submit", onSubmit);
  document.getElementById("githubForm").addEventListener("submit", onSubmit);
})();
<\/script>
</body>
</html>`;
}

export function renderErrorPage(status: number, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RepoProof — Error ${status}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #212529; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; padding: 48px 16px; text-align: center; }
  .code { font-size: 3rem; font-weight: 800; color: #c62828; }
  .msg { margin: 12px 0 24px; }
  a { color: #1565c0; }
</style>
</head>
<body>
<div class="container">
  <div class="code">${status}</div>
  <p class="msg">${escapeHtml(message)}</p>
  <p><a href="/">&larr; Back to dashboard</a></p>
</div>
</body>
</html>`;
}

export interface WebChrome {
  /** Label for where the scan came from, e.g. a folder path or owner/repo. */
  sourceLabel: string;
  /** Delta banner text, e.g. "78 (+5 vs last run)" — omitted when no baseline. */
  deltaText?: string;
}

/**
 * Wrap reporter HTML with web chrome: a back bar plus an optional score
 * delta banner. Injected before </body> so the reporter's own markup,
 * styles, and scripts stay byte-identical and keep working.
 */
export function withWebChrome(reportHtml: string, chrome: WebChrome): string {
  const delta = chrome.deltaText
    ? `<span class="web-delta">${escapeHtml(chrome.deltaText)}</span>`
    : "";
  const bar = `<div class="webnav"><a href="/">&larr; New scan</a><span class="web-source">${escapeHtml(chrome.sourceLabel)}</span>${delta}</div>
<style>.webnav{display:flex;gap:16px;align-items:center;padding:9px 32px;background:var(--color-surface);border-bottom:1px solid var(--color-border);font-family:var(--font-mono);font-size:.72rem;position:sticky;top:0;z-index:10}.webnav a{color:var(--color-accent);text-decoration:none}.webnav .web-source{color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw}.webnav .web-delta{color:var(--color-accent);font-weight:700;margin-left:auto}</style>`;
  if (reportHtml.includes("</body>")) {
    return reportHtml.replace("</body>", `${bar}</body>`);
  }
  return `${bar}${reportHtml}`;
}

export function formatDeltaBanner(report: ScanReport, baseline: number): string {
  const delta = report.score - baseline;
  const sign = delta > 0 ? "+" : delta < 0 ? "\u2212" : "";
  return `${report.score.toFixed(1)} (${sign}${Math.abs(delta).toFixed(1)} vs last run)`;
}

export interface PageResult {
  status: number;
  contentType: string;
  body: string;
}

export interface ScanHandlerOptions {
  cloneRunner?: CloneRunner;
  /** Set false in tests to avoid writing history to real fixture dirs. */
  recordHistory?: boolean;
}

function baselineBanner(resolvedPath: string, report: ScanReport): string | undefined {
  const history = readHistory(resolvedPath);
  if (history.length === 0) return undefined;
  const baseline = resolveBaseline(undefined, history);
  if (baseline === undefined) return undefined;
  return formatDeltaBanner(report, baseline);
}

function recordWebScan(resolvedPath: string, report: ScanReport): void {
  appendHistory(resolvedPath, {
    timestamp: report.timestamp,
    score: report.score,
    grade: report.grade,
    findingsCount: report.findings.length,
  });
}

export async function handleLocalScan(
  target: string,
  options?: ScanHandlerOptions,
): Promise<PageResult> {
  const trimmed = (target ?? "").trim();
  if (!trimmed) {
    return {
      status: 400,
      contentType: "text/html; charset=utf-8",
      body: renderErrorPage(400, "Enter a local folder path to scan."),
    };
  }
  try {
    const { report, resolvedPath } = await performScan({ targetPath: trimmed });
    const body = withWebChrome(
      generateHtmlReport(report, { targetLabel: resolvedPath, targetKind: "local" }),
      {
        sourceLabel: resolvedPath,
        deltaText: baselineBanner(resolvedPath, report),
      },
    );
    if (options?.recordHistory !== false) {
      recordWebScan(resolvedPath, report);
    }
    return { status: 200, contentType: "text/html; charset=utf-8", body };
  } catch (err) {
    return {
      status: 400,
      contentType: "text/html; charset=utf-8",
      body: renderErrorPage(400, `Cannot scan "${trimmed}": ${(err as Error).message}`),
    };
  }
}

export async function handleGithubScan(
  input: string,
  options?: ScanHandlerOptions,
): Promise<PageResult> {
  const target = parseGitHubTarget(input ?? "");
  if (!target) {
    return {
      status: 400,
      contentType: "text/html; charset=utf-8",
      body: renderErrorPage(
        400,
        'Enter a public repository as "owner/name" or "https://github.com/owner/name".',
      ),
    };
  }

  // Shallow clone into the OS temp dir; always cleaned up after the scan —
  // no cache is kept between scans.
  let parent: string | null = null;
  try {
    parent = await mkdtemp(join(tmpdir(), "repoproof-clone-"));
    const dest = join(parent, "repo");
    try {
      await cloneShallowRepo(target.cloneUrl, dest, options?.cloneRunner);
    } catch (err) {
      return {
        status: 502,
        contentType: "text/html; charset=utf-8",
        body: renderErrorPage(502, `Clone failed: ${friendlyCloneError((err as Error).message)}`),
      };
    }
    const { report } = await performScan({ targetPath: dest });
    const body = withWebChrome(
      generateHtmlReport(report, {
        targetLabel: `${target.owner}/${target.repo}`,
        targetKind: "github",
      }),
      {
        sourceLabel: `${target.owner}/${target.repo} (shallow clone, deleted after scan)`,
      },
    );
    return { status: 200, contentType: "text/html; charset=utf-8", body };
  } catch (err) {
    return {
      status: 500,
      contentType: "text/html; charset=utf-8",
      body: renderErrorPage(500, `Scan failed: ${(err as Error).message}`.slice(0, 500)),
    };
  } finally {
    if (parent) {
      await rm(parent, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export async function routeRequest(
  method: string,
  url: string,
  options?: ScanHandlerOptions,
): Promise<PageResult> {
  const parsed = new URL(url, "http://127.0.0.1");
  if (method === "GET" && parsed.pathname === "/") {
    return { status: 200, contentType: "text/html; charset=utf-8", body: renderDashboard() };
  }
  if (method === "GET" && parsed.pathname === "/scan") {
    const mode = parsed.searchParams.get("mode") ?? "local";
    const target = parsed.searchParams.get("target") ?? "";
    if (mode === "github") return handleGithubScan(target, options);
    return handleLocalScan(target, options);
  }
  return {
    status: 404,
    contentType: "text/html; charset=utf-8",
    body: renderErrorPage(404, "Not found."),
  };
}

export function createRequestHandler(options?: ScanHandlerOptions) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      try {
        const result = await routeRequest(req.method ?? "GET", req.url ?? "/", options);
        res.writeHead(result.status, { "Content-Type": result.contentType });
        res.end(result.body);
      } catch (err) {
        // The server never crashes on a bad request — always answer.
        try {
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderErrorPage(500, `Unexpected error: ${(err as Error).message}`));
        } catch {
          try {
            res.end();
          } catch {
            // ignore
          }
        }
      }
    })();
  };
}

export function startServer(port: number = DEFAULT_PORT): Promise<{ server: Server; url: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      rejectPromise(new Error(`Invalid port: ${String(port)}. Use 0-65535 (0 = OS-assigned).`));
      return;
    }
    const server = createServer(createRequestHandler());
    server.once("error", (err: unknown) => {
      const code = (err as { code?: string }).code;
      if (code === "EADDRINUSE") {
        rejectPromise(new Error(`Port ${port} is already in use.`));
      } else {
        rejectPromise(err as Error);
      }
    });
    // Loopback only — never exposed to the network.
    server.listen(port, LOOPBACK_HOST, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address !== null ? address.port : port;
      resolvePromise({ server, url: `http://${LOOPBACK_HOST}:${actualPort}` });
    });
  });
}

export type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => { unref: () => void };

/** Best-effort browser open. Always prints the URL separately — never throws. */
export async function openBrowser(
  url: string,
  deps?: { platform?: NodeJS.Platform; spawnFn?: SpawnFn },
): Promise<boolean> {
  try {
    const platform = deps?.platform ?? process.platform;
    const spawnFn = deps?.spawnFn ?? spawn;
    let command: string;
    let args: string[];
    if (platform === "win32") {
      command = "cmd";
      args = ["/c", "start", "", url];
    } else if (platform === "darwin") {
      command = "open";
      args = [url];
    } else {
      command = "xdg-open";
      args = [url];
    }
    const child = spawnFn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
