#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanDirectory, createScanContext } from "../engine/scanner.js";
import { runRules, calculateScore, getResultsBySeverity } from "../engine/rule-runner.js";
import { loadConfig, findConfig } from "../config/config-loader.js";
import { rules } from "../rules/index.js";
import { generateTextReport } from "../reporters/text-reporter.js";
import { generateJsonReport } from "../reporters/json-reporter.js";
import { generateMarkdownReport } from "../reporters/markdown-reporter.js";
import { generateHtmlReport } from "../reporters/html-reporter.js";
import { generateSarifReport } from "../reporters/sarif-reporter.js";
import { calculateGrade, ScanReport, Category } from "../types.js";

import { readFileSync } from "node:fs";

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
}

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { version: string };
    return pkg.version;
  } catch {
    return "1.0.0";
  }
}

async function scanAction(scanPath: string | undefined, options: GlobalOptions) {
  const targetPath = scanPath || ".";
  const resolvedPath = resolve(targetPath);

  if (!existsSync(resolvedPath)) {
    console.error(`Error: Path not found: ${targetPath}`);
    process.exit(1);
  }

  let config;
  if (options.config) {
    config = loadConfig(options.config);
  } else {
    const found = findConfig(resolvedPath);
    config = found ? loadConfig(found) : loadConfig();
  }

  const files = scanDirectory(resolvedPath, config);

  const context = createScanContext(files, config);

  const findings = await runRules(rules, context);

  const { score, categoryScores } = calculateScore(findings);
  const grade = calculateGrade(score);

  const minScore =
    options.minScore !== undefined ? Number(options.minScore) : (config.minScore ?? 0);
  const failOn = options.failOn ?? config.failOn ?? "error";

  const { errors, warnings, info } = getResultsBySeverity(findings);

  const enabledRules = rules.filter((r) => !(config.disabledRules ?? []).includes(r.id));
  const passingRuleIds = new Set(enabledRules.map((r) => r.id));
  for (const f of findings) {
    passingRuleIds.delete(f.id);
  }
  const passedChecks = passingRuleIds.size;

  const report: ScanReport = {
    version: getPackageVersion(),
    timestamp: new Date().toISOString(),
    score,
    grade,
    maxScore: 100,
    projectType: context.projectType,
    categoryScores,
    findings,
    config,
    summary: {
      totalFindings: findings.length,
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      passedChecks,
    },
  };

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
      output = generateHtmlReport(report);
      break;
    case "sarif":
      output = generateSarifReport(report);
      break;
    default:
      output = generateTextReport(report, {
        noColor: options.color === false,
        quiet: options.quiet,
        verbose: options.verbose,
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

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
