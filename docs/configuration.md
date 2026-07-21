# Configuration

RepoProof supports configuration files to customize scanning behavior. Configuration is loaded from the project root and can be specified in three formats:

- `.repoproof.json`
- `.repoproof.jsonc` (supports comments and trailing commas)
- `repoproof.config.json`

Configuration files are discovered by walking up from the scanned directory to the filesystem root. The first match is used.

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
