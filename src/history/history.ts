import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const HISTORY_DIRNAME = ".repoproof";
export const HISTORY_FILENAME = "history.json";
export const MAX_HISTORY_ENTRIES = 50;

export interface HistoryEntry {
  timestamp: string;
  score: number;
  grade: string;
  findingsCount: number;
}

export function historyFilePath(dirPath: string): string {
  return join(resolve(dirPath), HISTORY_DIRNAME, HISTORY_FILENAME);
}

function isValidEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.timestamp === "string" &&
    typeof e.score === "number" &&
    Number.isFinite(e.score) &&
    typeof e.grade === "string" &&
    typeof e.findingsCount === "number" &&
    Number.isFinite(e.findingsCount)
  );
}

/**
 * Read scan history. Never throws — a missing, unreadable, or corrupt
 * file means "no history" (same pattern as `loadIgnoreFile`).
 */
export function readHistory(dirPath: string): HistoryEntry[] {
  let raw: string;
  try {
    const filePath = historyFilePath(dirPath);
    if (!existsSync(filePath)) return [];
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

/**
 * Append one entry, keeping only the last MAX_HISTORY_ENTRIES runs so the
 * file cannot grow unbounded. Never throws — history must never fail a scan.
 */
export function appendHistory(dirPath: string, entry: HistoryEntry): void {
  try {
    const filePath = historyFilePath(dirPath);
    const entries = readHistory(dirPath);
    entries.push(entry);
    const trimmed = entries.slice(-MAX_HISTORY_ENTRIES);
    mkdirSync(join(resolve(dirPath), HISTORY_DIRNAME), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(trimmed, null, 2)}\n`, "utf-8");
  } catch {
    // History is best-effort; a scan result matters more than its record.
  }
}

/**
 * Baseline resolution priority (pure function, easily tested):
 * 1. Explicit `--baseline-score` flag wins (current behavior, untouched —
 *    including NaN for garbage input, which the reporter skips as absent).
 * 2. Otherwise the most recent history entry's score (auto-baseline).
 * 3. Otherwise undefined (current no-baseline behavior).
 */
export function resolveBaseline(
  explicitFlag: string | undefined,
  history: HistoryEntry[],
): number | undefined {
  if (explicitFlag !== undefined && explicitFlag !== "") {
    return Number(explicitFlag);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const score = history[i].score;
    if (typeof score === "number" && Number.isFinite(score)) return score;
  }
  return undefined;
}
