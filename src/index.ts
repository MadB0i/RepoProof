export { scanDirectory, detectProjectType, createScanContext } from "./engine/scanner.js";
export { runRules, calculateScore, getResultsBySeverity } from "./engine/rule-runner.js";
export {
  loadConfig,
  findConfig,
  resolveConfigPath,
  validateConfig,
} from "./config/config-loader.js";
export {
  loadIgnoreFile,
  parseIgnoreFile,
  isIgnoredByPatterns,
  matchIgnorePattern,
  IGNORE_FILENAME,
} from "./config/ignore-file.js";
export { rules as allRules } from "./rules/index.js";
export { generateTextReport } from "./reporters/text-reporter.js";
export { generateJsonReport } from "./reporters/json-reporter.js";
export { generateMarkdownReport } from "./reporters/markdown-reporter.js";
export { generateHtmlReport } from "./reporters/html-reporter.js";
export { generateSarifReport } from "./reporters/sarif-reporter.js";
export { performScan, getPackageVersion, type ScanInput, type ScanResult } from "./engine/scan.js";
export {
  readHistory,
  appendHistory,
  resolveBaseline,
  historyFilePath,
  HISTORY_DIRNAME,
  HISTORY_FILENAME,
  MAX_HISTORY_ENTRIES,
  type HistoryEntry,
} from "./history/history.js";
export * from "./types.js";
