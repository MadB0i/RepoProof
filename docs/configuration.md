# Configuration

RepoProof supports configuration files to customize scanning behavior. Configuration is loaded from the project root and can be specified in five formats:

- `.repoproof.json`
- `.repoproof.jsonc` (supports comments and trailing commas)
- `repoproof.config.json`
- `.repoproofrc.json`
- `.repoproofrc` (extensionless dotfile; supports comments and trailing commas like `.jsonc`)

Configuration files are discovered by walking up from the scanned directory to the filesystem root. The first match is used; when several names exist in the same directory, earlier names in the list above win (so existing projects keep their resolution order).

## Schema

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/MadB0i/RepoProof/main/schema.json",
  "minScore": 70,
  "maxFileSize": 1048576,
  "failOn": "error",
  "ignoredPaths": ["dist", "build", ".git", "node_modules"],
  "disabledRules": [],
  "severityOverrides": {
    "todo-fixme": "error",
  },
  "penaltyOverrides": {
    "empty-function": 1,
  },
  "includedPaths": ["src"],
  "excludedPaths": ["test/fixtures"],
}
```

## Options

| Option              | Type     | Default        | Description                                                                                                                                           |
| ------------------- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minScore`          | integer  | 70             | Minimum passing score (0–100). Scan exits with code 1 if score is below this.                                                                         |
| `maxFileSize`       | integer  | 1048576 (1 MB) | Maximum file size in bytes to scan. Files larger than this are skipped. Minimum 1024.                                                                 |
| `failOn`            | string   | `"error"`      | Minimum severity to fail on. `"error"` fails on errors only. `"warning"` fails on errors or warnings.                                                 |
| `ignoredPaths`      | string[] | `[]`           | Additional glob patterns to ignore beyond the built-in defaults (`node_modules`, `.git`, `dist`, `build`, `target`, `coverage`, `__pycache__`, etc.). |
| `disabledRules`     | string[] | `[]`           | Rule IDs to disable entirely. Findings from disabled rules are not included in the report.                                                            |
| `severityOverrides` | object   | `{}`           | Override severity for specific rules. Values must be `"error"`, `"warning"`, or `"info"`.                                                             |
| `penaltyOverrides`  | object   | `{}`           | Override score penalty for specific rules. Values must be non-negative integers.                                                                      |
| `includedPaths`     | string[] | `[]`           | Only scan files whose relative paths begin with one of these prefixes. Empty array means scan all files.                                              |
| `excludedPaths`     | string[] | `[]`           | Exclude files whose relative paths begin with one of these prefixes.                                                                                  |

## Default Configuration

If no configuration file is found, RepoProof uses:

```json
{
  "minScore": 70,
  "maxFileSize": 1048576,
  "failOn": "error"
}
```

## JSON Schema

A JSON Schema is available for IDE autocompletion and validation:

```
https://raw.githubusercontent.com/MadB0i/RepoProof/main/schema.json
```

Reference it in your configuration file:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/MadB0i/RepoProof/main/schema.json",
}
```

## `.repoproofignore` File

Similar to `.gitignore`, you can place a `.repoproofignore` file in the scanned directory root to exclude files from scans:

```gitignore
# comments and blank lines are ignored
*.log
generated/
fixtures/sample-data.json
```

Supported syntax: `*` (any run of non-`/` chars), `?` (one char), `**` (any chars including `/`), trailing-slash directory patterns (`generated/`), and anchored paths (`fixtures/data.json`). Patterns without a `/` match at any depth. `!` negation is **not** supported — those lines are skipped.

Ignore-file patterns **merge additively** with `ignoredPaths`/`excludedPaths` from config: both apply (union). Config cannot re-include something the ignore file excludes.

## Score History (Trend Tracking)

After every completed scan, RepoProof appends `{timestamp, score, grade, findingsCount}` to `.repoproof/history.json` in the scanned directory (only the last 50 runs are kept). The `.repoproof/` directory is never scanned itself.

On the next run, the most recent recorded score automatically becomes the baseline, so the text report footer shows e.g. `Score change vs baseline (85.0): +5.0` without any flags. An explicit `--baseline-score <number>` always wins over history; with neither, no delta line is shown.

Skip history entirely (read and write) for ephemeral CI runs with:

```bash
npx repoproof scan . --no-history
```

A missing, unreadable, or corrupt `history.json` is treated as "no history" — it never fails a scan.

## Init Command

Create a starter configuration file with:

```bash
npx repoproof init
```

This creates a `.repoproof.jsonc` file in the current directory with all available options commented out.

## CLI Overrides

Command-line flags override configuration file values:

| CLI Flag               | Overrides                                |
| ---------------------- | ---------------------------------------- |
| `--min-score <number>` | `minScore`                               |
| `--fail-on <level>`    | `failOn`                                 |
| `--config <path>`      | Path to config (bypasses auto-discovery) |

Config source priority: explicit `--config <path>` wins > auto-discovered file > built-in defaults. A missing auto-discovered file silently falls back to defaults; an explicitly given or discovered file with malformed JSON fails fast with a clear `Invalid JSON/JSONC` error (a typo should be loud, not silent).

## Web UI

`repoproof serve [--port 4321]` starts a local dashboard at `http://127.0.0.1:<port>` (loopback only — never exposed to the network) and tries to open it in your browser. The dashboard scans local folders directly and shallow-clones public GitHub repos (`owner/name` or full URL) into the OS temp dir, deleting the clone right after the scan. Web scans use the same pipeline as `scan` (including score-history baselines). See the README's Web UI section for details.
