import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { RepoProofConfig, Severity } from "../types.js";

const CONFIG_FILENAMES = [".repoproof.json", ".repoproof.jsonc", "repoproof.config.json"];

const DEFAULT_CONFIG: RepoProofConfig = {
  minScore: 70,
  maxFileSize: 1048576,
  maxFiles: 10000,
  maxTotalBytes: 524288000,
  maxDirectoryDepth: 50,
  failOn: "error",
};

function stripJsoncComments(jsonc: string): string {
  let result = jsonc.replace(/\/\*[\s\S]*?\*\//g, "");
  result = result.replace(/\/\/.*$/gm, "");
  result = result.replace(/,(\s*[}\]])/g, "$1");
  return result;
}

const MAX_DIR_DEPTH = 50;

export function findConfig(startDir: string): string | null {
  let current = resolve(startDir);
  let depth = 0;
  while (depth < MAX_DIR_DEPTH) {
    for (const filename of CONFIG_FILENAMES) {
      const filePath = join(current, filename);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    depth++;
  }
  return null;
}

export function validateConfig(config: unknown): RepoProofConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("Configuration must be a non-null object");
  }

  const cfg = config as Record<string, unknown>;
  const result: RepoProofConfig = { ...DEFAULT_CONFIG };

  if (cfg.ignoredPaths !== undefined) {
    if (!Array.isArray(cfg.ignoredPaths) || !cfg.ignoredPaths.every((p) => typeof p === "string")) {
      throw new Error("'ignoredPaths' must be an array of strings");
    }
    result.ignoredPaths = cfg.ignoredPaths as string[];
  }

  if (cfg.disabledRules !== undefined) {
    if (
      !Array.isArray(cfg.disabledRules) ||
      !cfg.disabledRules.every((r) => typeof r === "string")
    ) {
      throw new Error("'disabledRules' must be an array of strings");
    }
    result.disabledRules = cfg.disabledRules as string[];
  }

  if (cfg.severityOverrides !== undefined) {
    if (typeof cfg.severityOverrides !== "object" || cfg.severityOverrides === null) {
      throw new Error("'severityOverrides' must be an object");
    }
    const validSeverities: Severity[] = ["error", "warning", "info"];
    for (const [key, value] of Object.entries(cfg.severityOverrides)) {
      if (!validSeverities.includes(value as Severity)) {
        throw new Error(
          `'severityOverrides.${key}' must be "error", "warning", or "info", got ${JSON.stringify(value)}`,
        );
      }
    }
    result.severityOverrides = cfg.severityOverrides as Record<string, Severity>;
  }

  if (cfg.penaltyOverrides !== undefined) {
    if (typeof cfg.penaltyOverrides !== "object" || cfg.penaltyOverrides === null) {
      throw new Error("'penaltyOverrides' must be an object");
    }
    for (const [key, value] of Object.entries(cfg.penaltyOverrides)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(
          `'penaltyOverrides.${key}' must be a non-negative finite number, got ${JSON.stringify(value)}`,
        );
      }
    }
    result.penaltyOverrides = cfg.penaltyOverrides as Record<string, number>;
  }

  if (cfg.minScore !== undefined) {
    if (
      typeof cfg.minScore !== "number" ||
      !Number.isFinite(cfg.minScore) ||
      cfg.minScore < 0 ||
      cfg.minScore > 100
    ) {
      throw new Error("'minScore' must be a number between 0 and 100");
    }
    result.minScore = cfg.minScore;
  }

  if (cfg.maxFileSize !== undefined) {
    if (
      typeof cfg.maxFileSize !== "number" ||
      !Number.isFinite(cfg.maxFileSize) ||
      cfg.maxFileSize < 0
    ) {
      throw new Error("'maxFileSize' must be a non-negative number");
    }
    result.maxFileSize = cfg.maxFileSize;
  }

  if (cfg.includedPaths !== undefined) {
    if (
      !Array.isArray(cfg.includedPaths) ||
      !cfg.includedPaths.every((p) => typeof p === "string")
    ) {
      throw new Error("'includedPaths' must be an array of strings");
    }
    result.includedPaths = cfg.includedPaths as string[];
  }

  if (cfg.excludedPaths !== undefined) {
    if (
      !Array.isArray(cfg.excludedPaths) ||
      !cfg.excludedPaths.every((p) => typeof p === "string")
    ) {
      throw new Error("'excludedPaths' must be an array of strings");
    }
    result.excludedPaths = cfg.excludedPaths as string[];
  }

  if (cfg.maxFiles !== undefined) {
    if (
      typeof cfg.maxFiles !== "number" ||
      !Number.isFinite(cfg.maxFiles) ||
      !Number.isInteger(cfg.maxFiles) ||
      cfg.maxFiles < 1
    ) {
      throw new Error("'maxFiles' must be a positive integer");
    }
    result.maxFiles = cfg.maxFiles;
  }

  if (cfg.maxTotalBytes !== undefined) {
    if (
      typeof cfg.maxTotalBytes !== "number" ||
      !Number.isFinite(cfg.maxTotalBytes) ||
      !Number.isInteger(cfg.maxTotalBytes) ||
      cfg.maxTotalBytes < 1024
    ) {
      throw new Error("'maxTotalBytes' must be an integer >= 1024");
    }
    result.maxTotalBytes = cfg.maxTotalBytes;
  }

  if (cfg.maxDirectoryDepth !== undefined) {
    if (
      typeof cfg.maxDirectoryDepth !== "number" ||
      !Number.isFinite(cfg.maxDirectoryDepth) ||
      !Number.isInteger(cfg.maxDirectoryDepth) ||
      cfg.maxDirectoryDepth < 1
    ) {
      throw new Error("'maxDirectoryDepth' must be a positive integer");
    }
    result.maxDirectoryDepth = cfg.maxDirectoryDepth;
  }

  if (cfg.failOn !== undefined) {
    if (cfg.failOn !== "error" && cfg.failOn !== "warning") {
      throw new Error('\'failOn\' must be "error" or "warning"');
    }
    result.failOn = cfg.failOn as "error" | "warning";
  }

  return result;
}

export function loadConfig(configPath?: string): RepoProofConfig {
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read configuration file '${configPath}': ${(err as NodeJS.ErrnoException).message}`,
    );
  }

  const isJsonc = configPath.toLowerCase().endsWith(".jsonc");
  if (isJsonc) {
    raw = stripJsoncComments(raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const parseErr = err as SyntaxError;
    const msg = isJsonc
      ? `Invalid JSONC in '${configPath}': ${parseErr.message}`
      : `Invalid JSON in '${configPath}': ${parseErr.message}`;
    throw new Error(msg);
  }

  return validateConfig(parsed);
}
