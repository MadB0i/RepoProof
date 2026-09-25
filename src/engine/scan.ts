import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanDirectory, createScanContext } from "./scanner.js";
import { runRules, calculateScore, getResultsBySeverity } from "./rule-runner.js";
import { loadConfig, resolveConfigPath } from "../config/config-loader.js";
import { rules } from "../rules/index.js";
import { calculateGrade, ScanReport, RepoProofConfig } from "../types.js";

export function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { version: string };
    return pkg.version;
  } catch {
    return "1.0.0";
  }
}

export interface ScanInput {
  /** Directory to scan. Defaults to ".". */
  targetPath?: string;
  /** Explicit config file path. Bypasses auto-discovery when set. */
  configPath?: string;
}

export interface ScanResult {
  report: ScanReport;
  config: RepoProofConfig;
  resolvedPath: string;
  fileCount: number;
  ruleCount: number;
}

/**
 * Run a full scan: resolve path → load config (explicit flag >
 * auto-discovered > defaults) → scan files → run rules → score → report.
 * Shared by the CLI and the web server — no console output, no process
 * exit here. Throws on tool errors (missing path, bad config).
 */
export async function performScan(input: ScanInput): Promise<ScanResult> {
  const targetPath = input.targetPath || ".";
  const resolvedPath = resolve(targetPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Path not found: ${targetPath}`);
  }

  const configSource = resolveConfigPath(input.configPath, resolvedPath);
  const config = configSource ? loadConfig(configSource) : loadConfig();

  const files = scanDirectory(resolvedPath, config);

  const context = createScanContext(files, config, resolvedPath);

  const findings = await runRules(rules, context);

  const { score, categoryScores } = calculateScore(findings);
  const grade = calculateGrade(score);

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

  return { report, config, resolvedPath, fileCount: files.length, ruleCount: rules.length };
}
