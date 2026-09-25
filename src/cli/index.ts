#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getResultsBySeverity } from "../engine/rule-runner.js";
import { performScan, getPackageVersion } from "../engine/scan.js";
import { rules } from "../rules/index.js";
import { generateTextReport } from "../reporters/text-reporter.js";
import { generateJsonReport } from "../reporters/json-reporter.js";
import { generateMarkdownReport } from "../reporters/markdown-reporter.js";
import { generateHtmlReport } from "../reporters/html-reporter.js";
import { generateSarifReport } from "../reporters/sarif-reporter.js";
import { Category } from "../types.js";
import { readHistory, appendHistory, resolveBaseline } from "../history/history.js";
import { startServer, openBrowser, DEFAULT_PORT } from "../web/server.js";
import { fetchGitHubRepository } from "../github/index.js";
import { generateGitHubSummary } from "../github/reporter.js";
import { GitHubApiError } from "../github/client.js";

const CATEGORY_LABELS: Record<Category, string> = {
  "incomplete-implementation": "Incomplete Implementation",
  tests: "Tests",
  "security-configuration": "Security Configuration",
  "error-handling-reliability": "Error Handling & Reliability",
  "repository-readiness": "Repository Readiness",
};

const SEVERITY_LABELS: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

type ReportFormat = "text" | "json" | "markdown" | "html" | "sarif";

interface GlobalOptions {
  format?: ReportFormat;
  output?: string;
  minScore?: string;
  failOn?: "error" | "warning";
  config?: string;
  color?: boolean;
  noColor?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  baselineScore?: string;
  progress?: boolean;
  // Set by `--no-history` (commander negation: `--no-x` yields `x === false`).
  history?: boolean;
}

import { shouldShowProgress, formatProgressMessage } from "./progress.js";

export { shouldShowProgress, formatProgressMessage };

async function scanAction(scanPath: string | undefined, options: GlobalOptions) {
  // Shared scan pipeline (also used by `repoproof serve`). Throws on tool
  // errors; the scan command wrapper below turns those into exit code 1.
  const { report, config, resolvedPath, fileCount, ruleCount } = await performScan({
    targetPath: scanPath,
    configPath: options.config,
  });

  if (shouldShowProgress(options, process.stderr.isTTY ?? false)) {
    console.error(formatProgressMessage(fileCount, ruleCount));
  }

  const { score, findings } = report;

  const minScore =
    options.minScore !== undefined ? Number(options.minScore) : (config.minScore ?? 0);
  const failOn = options.failOn ?? config.failOn ?? "error";

  const { errors, warnings } = getResultsBySeverity(findings);

  const format = options.format ?? "text";
  const validFormats: ReportFormat[] = ["text", "json", "markdown", "html", "sarif"];
  if (!validFormats.includes(format as ReportFormat)) {
    console.error(`Error: Invalid format "${format}". Must be one of: ${validFormats.join(", ")}`);
    process.exit(1);
  }

  let output: string;
  switch (format) {
    case "json":
      output = generateJsonReport(report);
      break;
    case "markdown":
      output = generateMarkdownReport(report);
      break;
    case "html":
      output = generateHtmlReport(report, { targetLabel: resolvedPath, targetKind: "local" });
      break;
    case "sarif":
      output = generateSarifReport(report);
      break;
    default:
      output = generateTextReport(report, {
        noColor: options.color === false,
        quiet: options.quiet,
        verbose: options.verbose,
        // Priority: explicit --baseline-score flag wins (unchanged behavior),
        // otherwise the last recorded run auto-baselines, otherwise no delta.
        baselineScore: resolveBaseline(
          options.baselineScore,
          options.history === false ? [] : readHistory(resolvedPath),
        ),
      });
      break;
  }

  if (options.output) {
    const outputPath = resolve(options.output);
    try {
      writeFileSync(outputPath, output, "utf-8");
    } catch (err) {
      console.error(`Error: Cannot write report to ${outputPath}: ${(err as Error).message}`);
      process.exit(1);
    }
    if (format === "html" || format === "json" || format === "markdown" || format === "sarif") {
      console.log(`Report written to: ${outputPath}`);
    } else {
      console.log(output);
    }
  } else {
    console.log(output);
  }

  // Record this completed scan for future auto-baselines. Runs that fail
  // as findings-above-threshold still count (the scan completed); tool
  // errors exit earlier and record nothing. Never fails the scan.
  if (options.history !== false) {
    appendHistory(resolvedPath, {
      timestamp: report.timestamp,
      score: report.score,
      grade: report.grade,
      findingsCount: findings.length,
    });
  }

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const shouldFail = failOn === "error" ? hasErrors : hasErrors || hasWarnings;

  if (shouldFail || score < minScore) {
    process.exit(1);
  }
}

function initAction(_options: GlobalOptions) {
  const configPath = resolve(".repoproof.jsonc");

  if (existsSync(configPath)) {
    console.warn("Warning: .repoproof.jsonc already exists. Skipping initialization.");
    return;
  }

  const starterConfig = `{
  // Minimum score required to pass (0-100)
  "minScore": 70,

  // Maximum file size in bytes to scan (files larger than this are skipped)
  "maxFileSize": 1048576,

  // Maximum number of files to scan (scanning stops when limit is reached)
  "maxFiles": 10000,

  // Maximum total bytes to scan across all files
  "maxTotalBytes": 524288000,

  // Maximum directory depth to traverse
  "maxDirectoryDepth": 50,

  // Fail condition: "error" fails on any error, "warning" fails on errors or warnings
  "failOn": "error",

  // Directories or files to ignore (relative to project root)
  "ignoredPaths": ["dist", "build", ".git", "node_modules"],

  // Rule IDs to disable entirely
  "disabledRules": [],

  // Override severity for specific rules (values: "error", "warning", "info")
  "severityOverrides": {},

  // Override score penalty for specific rules
  "penaltyOverrides": {},

  // Only scan files whose paths begin with these prefixes (empty = scan all)
  "includedPaths": [],

  // Exclude files whose paths begin with these prefixes
  "excludedPaths": []
}
`;

  try {
    writeFileSync(configPath, starterConfig, "utf-8");
    console.log("Created .repoproof.jsonc");
  } catch (err) {
    console.error(`Error: Failed to write configuration: ${(err as Error).message}`);
    process.exit(1);
  }
}

function explainAction(ruleId: string, _options: GlobalOptions) {
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) {
    console.error(`Error: Rule not found: ${ruleId}`);
    process.exit(1);
  }

  console.log(`\n  Rule ID:       ${rule.id}`);
  console.log(`  Title:         ${rule.title}`);
  console.log(`  Description:   ${rule.description}`);
  console.log(`  Severity:      ${SEVERITY_LABELS[rule.severity] ?? rule.severity}`);
  console.log(`  Category:      ${CATEGORY_LABELS[rule.category] ?? rule.category}`);
  console.log(`  Score Penalty: ${rule.scorePenalty}`);
  if (rule.docUrl) {
    console.log(`  Documentation: ${rule.docUrl}`);
  }
  console.log("");
}

function listRulesAction(_options: GlobalOptions) {
  const grouped = new Map<Category, typeof rules>();
  for (const rule of rules) {
    const group = grouped.get(rule.category) ?? [];
    group.push(rule);
    grouped.set(rule.category, group);
  }

  const categories: Category[] = [
    "incomplete-implementation",
    "tests",
    "security-configuration",
    "error-handling-reliability",
    "repository-readiness",
  ];

  console.log("");
  console.log("  Available Rules");
  console.log("  " + "=".repeat(70));

  for (const cat of categories) {
    const groupRules = grouped.get(cat) ?? [];
    const label = CATEGORY_LABELS[cat] ?? cat;
    console.log("");
    console.log(`  ${label}`);
    console.log("  " + "-".repeat(70));
    console.log(`  ${"ID".padEnd(28)} ${"Title".padEnd(28)} ${"Severity".padEnd(10)} Penalty`);
    console.log("  " + "-".repeat(70));

    for (const rule of groupRules) {
      const id = rule.id.padEnd(28);
      const title =
        rule.title.length > 27 ? rule.title.slice(0, 24) + "..." : rule.title.padEnd(28);
      const severity = (SEVERITY_LABELS[rule.severity] ?? rule.severity).padEnd(10);
      const penalty = String(rule.scorePenalty);
      console.log(`  ${id} ${title} ${severity} ${penalty}`);
    }
  }

  console.log("");
  console.log(`  Total: ${rules.length} rule(s)`);
  console.log("");
}

async function githubAction(repository: string, options: GlobalOptions) {
  const info = await fetchGitHubRepository(repository);
  const output = generateGitHubSummary(info, { noColor: options.color === false });
  console.log(output);
}

const program = new Command();

program
  .name("repoproof")
  .description("Fast, deterministic, local-first CLI for auditing repository quality risks")
  .version(getPackageVersion())
  .option("--format <format>", "Output format: text, json, markdown, html, sarif", "text")
  .option("--output <path>", "Write report to file")
  .option("--min-score <number>", "Minimum passing score (overrides config)")
  .option("--fail-on <level>", "Fail on 'error' or 'warning'")
  .option("--config <path>", "Path to configuration file")
  .option("--no-color", "Disable colored output")
  .option("--quiet", "Minimal output")
  .option("--verbose", "Detailed output")
  .option("--baseline-score <number>", "Baseline score to compare against (shows delta)")
  .option("--progress", "Show scan progress on stderr")
  .option("--no-history", "Skip reading/writing scan history in .repoproof/")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals() as GlobalOptions;
    if (opts.color === false) {
      process.env.NO_COLOR = "1";
    }
  });

program
  .command("scan")
  .description("Scan a repository for quality risks")
  .argument("[path]", "Directory to scan", ".")
  .action(async (path: string | undefined, options: GlobalOptions) => {
    try {
      await scanAction(path, { ...program.optsWithGlobals(), ...options } as GlobalOptions);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Generate a starter configuration file")
  .action((options: GlobalOptions) => {
    try {
      initAction({ ...program.optsWithGlobals(), ...options } as GlobalOptions);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("explain")
  .description("Show documentation for a specific rule")
  .argument("<rule-id>", "Rule identifier")
  .action((ruleId: string, options: GlobalOptions) => {
    try {
      explainAction(ruleId, { ...program.optsWithGlobals(), ...options } as GlobalOptions);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("list-rules")
  .description("List all available rules")
  .action((options: GlobalOptions) => {
    try {
      listRulesAction({ ...program.optsWithGlobals(), ...options } as GlobalOptions);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("github")
  .description("Fetch repository metadata from the GitHub REST API")
  .argument("<repository>", "GitHub repository as owner/repo or github.com URL")
  .action(async (repository: string, options: GlobalOptions) => {
    try {
      await githubAction(repository, { ...program.optsWithGlobals(), ...options } as GlobalOptions);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exitCode = 1;
    }
  });

async function serveAction(options: { port?: string }) {
  const port = options.port !== undefined ? Number(options.port) : DEFAULT_PORT;
  try {
    const { url } = await startServer(port);
    console.log(`RepoProof dashboard: ${url}`);
    console.log("Serving on 127.0.0.1 only. Press Ctrl+C to stop.");
    const opened = await openBrowser(url);
    if (!opened) {
      console.log("Could not open a browser automatically — open the URL above manually.");
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

program
  .command("serve")
  .description("Start the local web dashboard (binds to 127.0.0.1 only)")
  .option("--port <number>", "Port to listen on", String(DEFAULT_PORT))
  .action(async (options: { port?: string }) => {
    await serveAction(options);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
