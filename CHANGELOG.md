# Changelog

## 1.0.0 (2026-07-21)

Initial release.

### Features

- **31 rules** across 5 categories:
  - Incomplete Implementation (6 rules)
  - Tests (5 rules)
  - Security & Configuration (6 rules)
  - Error Handling & Reliability (4 rules)
  - Repository Readiness (10 rules)
- **5 report formats:** text, JSON, Markdown, HTML (with light/dark mode, score gauge, filterable table), SARIF 2.1.0
- **Deterministic scoring** — same input always produces the same output
- **Category-based scoring** with per-category penalty caps
- **Configuration files:** `.repoproof.json`, `.repoproof.jsonc`, `repoproof.config.json`
- **CLI commands:** `scan`, `init`, `explain`, `list-rules`
- **JSON Schema** for IDE autocompletion
- **Privacy-first** — 100% local, no telemetry, no network calls
- **Parallel rule execution** with bounded concurrency (max 4)
- **Finding caps** — max 50 findings per rule, category penalty caps prevent single-rule domination
- **Severity/penalty overrides** per rule
- **Project type detection** — JavaScript, TypeScript, Python, Rust, Go, Java, Ruby, PHP, C#, Swift, Kotlin
- **GitHub Action integration** with SARIF, HTML artifact, and score badge support
