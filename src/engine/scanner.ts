import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ScannedFile, ScanContext, RepoProofConfig, ProjectType } from "../types.js";

const DEFAULT_MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const DEFAULT_MAX_FILES = 10000;
const DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500MB
const DEFAULT_MAX_DIR_DEPTH = 50;
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".env",
  "vendor",
  ".pnp",
  ".yarn",
]);

const IGNORED_FILES = new Set([
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Pipfile.lock",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".pyc",
  ".pyo",
  ".pyd",
  ".class",
  ".jar",
  ".o",
  ".a",
  ".lib",
]);

export function detectProjectType(files: ScannedFile[], dirPath?: string): ProjectType {
  const lockfileExists = (name: string): boolean =>
    files.some((f) => f.relativePath === name) ||
    (dirPath !== undefined && existsSync(join(dirPath, name)));
  return {
    languages: detectLanguages(files),
    hasPackageJson: files.some((f) => f.relativePath === "package.json"),
    hasTsconfig: files.some(
      (f) => f.relativePath === "tsconfig.json" || f.relativePath === "tsconfig.jsonc",
    ),
    hasPyprojectToml: files.some((f) => f.relativePath === "pyproject.toml"),
    hasRequirementsTxt: files.some((f) => f.relativePath === "requirements.txt"),
    hasCargoToml: files.some((f) => f.relativePath === "Cargo.toml"),
    hasGoMod: files.some((f) => f.relativePath === "go.mod"),
    hasDockerfile: files.some((f) => f.relativePath.toLowerCase().includes("dockerfile")),
    hasDockerCompose: files.some((f) => f.relativePath.toLowerCase().includes("docker-compose")),
    hasReadme: files.some((f) => /^readme/i.test(f.relativePath)),
    hasLicense: files.some((f) => /^license/i.test(f.relativePath)),
    hasContributing: files.some((f) => /^contributing/i.test(f.relativePath)),
    hasCodeOfConduct: files.some((f) => /^code.?of.?conduct/i.test(f.relativePath)),
    hasChangelog: files.some((f) => /^changelog/i.test(f.relativePath)),
    hasCiWorkflow: files.some(
      (f) =>
        (f.relativePath.includes(".github/workflows") && f.relativePath.endsWith(".yml")) ||
        f.relativePath.endsWith(".yaml"),
    ),
    hasGitignore: files.some((f) => f.relativePath === ".gitignore"),
    hasLockfile:
      lockfileExists("pnpm-lock.yaml") ||
      lockfileExists("pnpm-lock.yml") ||
      lockfileExists("package-lock.json") ||
      lockfileExists("yarn.lock") ||
      lockfileExists("Cargo.lock") ||
      lockfileExists("go.sum") ||
      lockfileExists("poetry.lock") ||
      lockfileExists("Pipfile.lock") ||
      lockfileExists("composer.lock") ||
      lockfileExists("Gemfile.lock"),
    hasTestDir: files.some(
      (f) =>
        f.relativePath.startsWith("test") ||
        f.relativePath.startsWith("tests") ||
        f.relativePath.startsWith("__tests__") ||
        f.relativePath.startsWith("spec"),
    ),
    hasEnvExample: files.some(
      (f) => /\.env\.example/i.test(f.relativePath) || /env\.example/i.test(f.relativePath),
    ),
    hasEditorConfig: files.some((f) => f.relativePath === ".editorconfig"),
  };
}

function detectLanguages(files: ScannedFile[]): string[] {
  const langs = new Set<string>();
  const extMap: Record<string, string> = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".py": "Python",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".swift": "Swift",
    ".kt": "Kotlin",
  };
  for (const f of files) {
    const ext = f.relativePath.slice(f.relativePath.lastIndexOf(".")).toLowerCase();
    if (extMap[ext]) langs.add(extMap[ext]);
  }
  return [...langs].sort();
}

function isBinaryFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function scanDirectory(
  dirPath: string,
  config: RepoProofConfig,
  _ignoredPaths?: string[],
): ScannedFile[] {
  const results: ScannedFile[] = [];
  const absDir = resolve(dirPath);
  const configIgnored = new Set((config.ignoredPaths ?? []).map((p) => p.replace(/\\/g, "/")));
  const maxDepth = config.maxDirectoryDepth ?? DEFAULT_MAX_DIR_DEPTH;
  const maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;
  const maxTotalBytes = config.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  let totalBytes = 0;
  let limitReached = false;
  const visitedDirs = new Set<string>();

  function walk(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;
    if (limitReached) return;
    if (results.length >= maxFiles) {
      limitReached = true;
      return;
    }
    if (totalBytes >= maxTotalBytes) {
      limitReached = true;
      return;
    }

    // Resolve real path to detect symlink loops (including Windows junctions)
    let realCurrent: string;
    try {
      realCurrent = resolve(currentPath);
    } catch {
      return;
    }
    if (visitedDirs.has(realCurrent)) return;
    visitedDirs.add(realCurrent);

    let entries: string[];
    try {
      entries = readdirSync(currentPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const relPath = relative(absDir, fullPath).replace(/\\/g, "/");

      // Path traversal check
      if (relPath.startsWith("..")) continue;

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      // Symlink loop detection - skip all symlinks (including Windows junctions)
      if (stat.isSymbolicLink()) {
        continue;
      }

      // Check if path should be ignored
      const relParts = relPath.split("/");
      if (relParts.some((p) => IGNORED_DIRS.has(p))) continue;
      if (IGNORED_FILES.has(entry)) continue;
      if (configIgnored.has(relPath)) continue;
      if (configIgnored.has(entry)) continue;
      if (config.excludedPaths?.some((p) => relPath.startsWith(p))) continue;
      if (config.includedPaths?.length && !config.includedPaths.some((p) => relPath.startsWith(p)))
        continue;

      if (stat.isDirectory()) {
        // Check real path to detect junctions/reparse points pointing outside the scan root
        try {
          const realDir = resolve(fullPath);
          if (!realDir.startsWith(absDir)) continue;
        } catch {
          continue;
        }
        walk(fullPath, depth + 1);
      } else if (stat.isFile()) {
        if (isBinaryFile(entry)) continue;
        if (stat.size > (config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE)) continue;
        if (totalBytes + stat.size > maxTotalBytes) {
          limitReached = true;
          return;
        }

        try {
          const content = readFileSync(fullPath, "utf-8");
          results.push({
            path: fullPath,
            relativePath: relPath,
            content,
            size: stat.size,
          });
          totalBytes += stat.size;
          if (results.length >= maxFiles || totalBytes >= maxTotalBytes) {
            limitReached = true;
            return;
          }
        } catch {
          void 0;
        }
      }
    }
  }

  walk(absDir, 0);

  // Sort for deterministic output
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}

export function createScanContext(
  files: ScannedFile[],
  config: RepoProofConfig,
  dirPath?: string,
): ScanContext {
  return {
    files,
    config,
    projectType: detectProjectType(files, dirPath),
  };
}
