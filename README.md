# RepoProof

**Fast, deterministic, local-first CLI for auditing repository-quality risks in AI-generated and rapidly generated software projects.**

```text
$ npx repoproof scan .

  RepoProof Report ──────────────────────────────────────
  Score: 67 / 100  Grade: D
  ─────────────────────────────────────────────────────
  Findings: 12 errors, 8 warnings, 3 info
  ─────────────────────────────────────────────────────
  Incomplete Implementation  12 / 20  ████████░░
  Tests                       8 / 20  ████░░░░░░
  Security Configuration     15 / 30  █████░░░░░
  Error Handling & Reliability 9 / 15  ██████░░░░
  Repository Readiness        8 / 15  █████░░░░░
  ─────────────────────────────────────────────────────
  FAIL (score 67 < minimum 70)
```

## Features

- **31 rules** across 5 categories — incomplete implementation, tests, security & configuration, error handling & reliability, and repository readiness
- **5 report formats** — text, JSON, Markdown, HTML (with light/dark mode, score gauge, interactive table), and SARIF
- **Zero network** — 100% local, nothing leaves your machine
- **Deterministic** — same input always produces the same output
- **Fast** — parallel rule execution with bounded concurrency
- **No dependencies** to install globally — runs via `npx`
- **Configurable** — JSON/JSONC configuration files with per-rule overrides
- **CI-ready** — exits with non-zero on failures, supports GitHub Actions

## Installation

```bash
# Run directly (no install)
npx repoproof scan .

# Install globally
npm install -g repoproof

# Or with pnpm
pnpm add -g repoproof
```

## Quick Start

```bash
# Scan the current directory
npx repoproof scan .

# Scan a specific path
npx repoproof scan ./path/to/project

# Generate an HTML report
npx repoproof scan . --format html --output report.html

# Generate a SARIF report for GitHub Code Scanning
npx repoproof scan . --format sarif --output results.sarif

# Explain a specific rule
npx repoproof explain hardcoded-secrets

# List all available rules
npx repoproof list-rules

# Create a starter configuration
npx repoproof init
```

## Example Findings

```javascript
// ❌ todo-fixme: TODO/FIXME markers in source code
function processData() {
  // TODO: implement this
  throw new Error("not implemented"); // ❌ not-implemented
}

// ❌ empty-function: Empty function body
function handleClick() {}

// ❌ hardcoded-secrets: API key in source
const apiKey = "sk-abc123def456ghi789jkl"; // [REDACTED]

// ❌ empty-catch: Silently swallowed error
try {
  await fetch("/api/data"); // ❌ no-http-timeout: No timeout set
} catch (e) {} // empty catch
```

## Reports

### HTML Report

![Example HTML Report](docs/report-example.png)
_Generate this by running `npx repoproof scan . --format html`_

### Supported Formats

| Format   | Command                   | Use Case                 |
| -------- | ------------------------- | ------------------------ |
| Text     | `--format text` (default) | Terminal output          |
| JSON     | `--format json`           | Programmatic consumption |
| Markdown | `--format markdown`       | PR comments, issues      |
| HTML     | `--format html`           | Visual browsing, sharing |
| SARIF    | `--format sarif`          | GitHub Code Scanning     |

## Supported Languages

RepoProof detects and scans projects written in:

- **JavaScript** (`.js`, `.jsx`, `.mjs`, `.cjs`)
- **TypeScript** (`.ts`, `.tsx`, `.mts`, `.cts`)
- **Python** (`.py`)
- **Rust** (`.rs`)
- **Go** (`.go`)
- **Java** (`.java`)
- **Ruby** (`.rb`)
- **PHP** (`.php`)
- **C#** (`.cs`)
- **Swift** (`.swift`)
- **Kotlin** (`.kt`)

Plus project-level detection for `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, Dockerfiles, CI workflows, and more.

## Configuration

Create a `.repoproof.json` or `.repoproof.jsonc` file in your project root:

```jsonc
{
  "minScore": 75,
  "failOn": "warning",
  "disabledRules": ["mock-data"],
  "severityOverrides": {
    "todo-fixme": "error",
  },
  "penaltyOverrides": {
    "empty-function": 1,
  },
  "ignoredPaths": ["dist", "generated"],
  "excludedPaths": ["test/fixtures"],
  "includedPaths": ["src"],
}
```

## Exit Codes

| Exit Code | Condition                                                                |
| --------- | ------------------------------------------------------------------------ |
| 0         | Scan passed (score ≥ min, no threshold hits)                             |
| 1         | Score below `--min-score`, or errors/warnings found matching `--fail-on` |
| 1         | Invalid path, config, format, or rule ID                                 |
| 1         | Cannot write output file                                                 |

## CI Integration

### GitHub Actions

```yaml
name: RepoProof Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx repoproof scan .
```

See [docs/github-action.md](docs/github-action.md) for a complete workflow with artifact upload and score badge.

## Privacy

RepoProof is **100% local-first**. Your source code never leaves your machine. No telemetry, no data collection, no external API calls. All analysis happens in-process using static pattern matching.

## Limitations

- **Static analysis only** — RepoProof does not execute your code. It cannot detect runtime issues, logic bugs, or dynamic security vulnerabilities.
- **Pattern-based** — Rules use regex and heuristics. False positives and false negatives are possible.
- **No AI detection guarantee** — RepoProof cannot definitively determine whether code was written by an AI or a human. It flags patterns commonly associated with low-quality output regardless of origin.
- **Language-agnostic heuristics** — Some rules apply best-effort heuristics across languages and may not catch every language-specific idiom.
- **No dependency analysis** — RepoProof does not check for vulnerable package versions or supply-chain risks.

## Roadmap

- [ ] Additional language support (Zig, Dart, Elixir)
- [ ] Custom rule definitions
- [ ] Baseline/suppression file support
- [ ] Pre-commit hook integration
- [ ] IDE plugin (VS Code, JetBrains)
- [ ] Team dashboard with historical trends
- [ ] AI-assisted remediation suggestions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and workflow.

## License

MIT — see [LICENSE](LICENSE).
