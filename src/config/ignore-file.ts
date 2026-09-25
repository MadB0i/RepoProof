import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const IGNORE_FILENAME = ".repoproofignore";

/**
 * Supported `.repoproofignore` syntax (intentional `.gitignore` subset):
 * - Blank lines and `#` comments are ignored.
 * - `dir/` (trailing slash) matches the directory and everything under it.
 * - Patterns without a `/` match a path segment at any depth
 *   (`build` matches `build`, `src/build`, `build/out.js` via the dir rule).
 * - `*` matches any run of non-`/` chars, `?` one non-`/` char,
 *   `**` any chars including `/` (`**\/dist` also matches root `dist`).
 * - A pattern containing `/` is anchored to the scan root.
 * - Leading `/` or `./` is stripped (same anchored meaning).
 *
 * NOT supported (lines are skipped): `!` negation. This keeps matching
 * purely additive — an ignore file can only exclude more, never re-include
 * something excluded by config — which is also why config and ignore file
 * merge by union instead of override.
 */
export function parseIgnoreFile(content: string): string[] {
  const patterns: string[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("!")) continue;
    patterns.push(normalizePattern(line));
  }
  return patterns;
}

function normalizePattern(pattern: string): string {
  let p = pattern.replace(/\\/g, "/").trim();
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/") && !p.startsWith("//")) p = p.slice(1);
  return p;
}

/**
 * Load ignore patterns from `<dir>/.repoproofignore`. Never throws —
 * a missing or unreadable file means "no extra ignores".
 */
export function loadIgnoreFile(dirPath: string): string[] {
  const filePath = join(dirPath, IGNORE_FILENAME);
  let exists = false;
  try {
    exists = existsSync(filePath);
  } catch {
    return [];
  }
  if (!exists) return [];
  try {
    return parseIgnoreFile(readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function globSegmentToRegExpSource(glob: string): string {
  // Token-based conversion so `**/` becomes an optional (`/`-aware) prefix.
  const DOUBLE_STAR_SLASH = "\u0000DSS\u0000";
  const DOUBLE_STAR = "\u0000DS\u0000";
  const STAR = "\u0000S\u0000";
  const QMARK = "\u0000Q\u0000";
  let tmp = glob
    .split("**/")
    .join(DOUBLE_STAR_SLASH)
    .split("**")
    .join(DOUBLE_STAR)
    .split("*")
    .join(STAR)
    .split("?")
    .join(QMARK);
  tmp = tmp.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return tmp
    .split(DOUBLE_STAR_SLASH)
    .join("(.*/)?")
    .split(DOUBLE_STAR)
    .join(".*")
    .split(STAR)
    .join("[^/]*")
    .split(QMARK)
    .join("[^/]");
}

function matchGlob(glob: string, value: string): boolean {
  return new RegExp(`^${globSegmentToRegExpSource(glob)}$`).test(value);
}

export function matchIgnorePattern(pattern: string, relPath: string): boolean {
  const path = relPath.replace(/\\/g, "/");
  if (pattern.length === 0) return false;

  // Directory pattern: `generated/` matches the dir and everything under it.
  if (pattern.endsWith("/")) {
    const dir = pattern.slice(0, -1);
    return path === dir || path.startsWith(`${dir}/`);
  }

  const anchored = pattern.includes("/");
  if (!anchored) {
    if (pattern.includes("*") || pattern.includes("?")) {
      const base = path.split("/").pop() ?? path;
      return matchGlob(pattern, base);
    }
    return path === pattern || path.split("/").includes(pattern);
  }

  if (pattern.includes("*") || pattern.includes("?")) {
    return matchGlob(pattern, path);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}

export function isIgnoredByPatterns(patterns: string[], relPath: string): boolean {
  return patterns.some((p) => matchIgnorePattern(p, relPath));
}
