# Rules

RepoProof includes 31 rules across 5 categories, each designed to catch patterns commonly found in incomplete, AI-generated, or rapidly prototyped code.

## Score Penalties

Each rule has a `scorePenalty` value that is subtracted from the category score per finding. Penalties are capped per category (see [Scoring](scoring.md)) to prevent a single noisy rule from dominating the overall score.

---

## Incomplete Implementation

Rules that detect unfinished code, placeholders, and temporary scaffolding left in the codebase.

| Rule ID            | Title                              | Severity | Penalty       | Description                                                                                           |
| ------------------ | ---------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `todo-fixme`       | TODO/FIXME markers in source code  | warning  | 2 per file    | Detects TODO, FIXME, HACK, XXX, BUG, WORKAROUND markers that indicate incomplete work                 |
| `not-implemented`  | Not implemented code paths         | error    | 5 per finding | Detects `throw new Error("not implemented")`, stub returns, and unimplemented code paths              |
| `empty-function`   | Empty function bodies              | warning  | 3 per finding | Detects function/method declarations with empty bodies that aren't abstract or interface declarations |
| `placeholder-text` | Placeholder text in source code    | warning  | 2 per file    | Detects "lorem ipsum", "placeholder", "coming soon", "under construction", "replace me"               |
| `commented-code`   | Commented-out code blocks          | warning  | 3 per block   | Detects 4+ consecutive lines of commented-out code that should be removed                             |
| `mock-data`        | Hardcoded mock data in source code | warning  | 3 per finding | Detects mock/fake/dummy data, demo credentials, and test data in production code                      |

**Why this matters:** These patterns are the strongest signal that code was generated quickly without proper review. Leftover TODO markers and stubs can silently ship incomplete features.

**How to fix:** Resolve each TODO/FIXME, implement stubs, remove commented-out code, and replace placeholder text with real content. Run `repoproof list-rules` to see all rules, then use `repoproof explain <rule-id>` for details on a specific finding.

---

## Tests

Rules that verify test suite quality and completeness.

| Rule ID             | Title                                                 | Severity | Penalty           | Description                                                                                      |
| ------------------- | ----------------------------------------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `disabled-tests`    | Disabled or focused tests                             | warning  | 5 per file        | Detects `.skip`, `.only`, `xdescribe`, `xit`, `xtest` test modifiers                             |
| `missing-tests`     | Missing test files for source files                   | warning  | 3 per source file | Detects source files without corresponding `.test.ts`/`.spec.ts` files                           |
| `empty-test-files`  | Empty test files or tests without assertions          | warning  | 4 per file        | Detects test files that are empty or contain no assertion calls                                  |
| `test-echo-command` | Test script is an echo placeholder                    | error    | 8 per finding     | Detects `package.json` test scripts that just echo a message instead of running a test framework |
| `coverage-excludes` | Coverage configuration excludes too many source files | warning  | 4 per file        | Detects overly broad coverage exclude patterns in vitest/jest/nyc/istanbul config                |

**Why this matters:** AI-generated projects often produce test files that look real but contain no assertions, or they disable tests to make the suite pass. Missing test infrastructure is a leading indicator of low-quality code.

**How to fix:** Remove `.skip`/`.only` modifiers from tests. Add test files for untested source modules. Ensure test files contain real assertions (`expect`, `assert`). Replace echo-based test scripts with a real test runner. Narrow coverage exclude patterns.

---

## Security & Configuration

Rules that flag hardcoded secrets, unsafe patterns, and weak security configurations.

| Rule ID             | Title                                   | Severity | Penalty        | Description                                                                                    |
| ------------------- | --------------------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `hardcoded-secrets` | Hardcoded secrets in source code        | error    | 10 per finding | Detects private keys, API keys, passwords, tokens, AWS keys, GitHub tokens, Stripe/OpenAI keys |
| `env-tracked`       | .env file tracked in repository         | error    | 8 per finding  | Detects `.env` files (not `.env.example`) tracked in the repo                                  |
| `unsafe-eval`       | Use of eval() or dynamic code execution | error    | 5 per finding  | Detects `eval()`, `new Function()`, `setTimeout`/`setInterval` with string arguments           |
| `wildcard-cors`     | Wildcard CORS configuration             | error    | 5 per finding  | Detects `Access-Control-Allow-Origin: *` and equivalent configurations                         |
| `debug-enabled`     | Debug mode enabled by default           | warning  | 4 per finding  | Detects `debug: true`, `NODE_ENV=development`, verbose logging in config files                 |
| `missing-gitignore` | Missing .gitignore file                 | warning  | 5 per finding  | Detects projects without a `.gitignore` file                                                   |

**Why this matters:** Hardcoded secrets are the #1 security risk in AI-generated code. Automated code generation tools may include real-looking but fake credentials, or worse, actual credentials scraped from training data. Unsafe patterns like `eval()` and wildcard CORS create exploitable vulnerabilities.

**How to fix:** Remove hardcoded secrets and use environment variables. Add `.env` to `.gitignore` and commit a `.env.example` instead. Replace `eval()` with safer alternatives. Restrict CORS to specific origins. Disable debug mode in production config. Create a `.gitignore`.

---

## Error Handling & Reliability

Rules that identify fragile error handling, resource leaks, and reliability anti-patterns.

| Rule ID             | Title                                       | Severity | Penalty       | Description                                                                     |
| ------------------- | ------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------- |
| `empty-catch`       | Empty catch blocks                          | warning  | 4 per finding | Detects empty `catch` blocks that silently swallow errors                       |
| `no-http-timeout`   | HTTP requests without timeout configuration | warning  | 3 per finding | Detects `fetch()`, `axios`, and HTTP client calls without timeout configuration |
| `unbounded-retries` | Unbounded retry loops                       | warning  | 4 per finding | Detects retry mechanisms without maximum count or timeout caps                  |
| `process-exit`      | process.exit() in library or module code    | error    | 5 per finding | Detects `process.exit()` calls outside CLI entry point files                    |

**Why this matters:** Poor error handling is a hallmark of rapidly generated code. Silent error swallowing makes debugging impossible. Missing timeouts cause hanging connections. Unbounded retries lead to resource exhaustion. `process.exit()` in library code can crash the host process.

**How to fix:** Always handle or log errors in catch blocks. Add timeout parameters to HTTP requests (e.g., `fetch(url, { signal: AbortSignal.timeout(5000) })`). Implement maximum retry counts with exponential backoff. Replace `process.exit()` with throwing errors or returning error codes.

---

## Repository Readiness

Rules that check project documentation, metadata, and essential repository files.

| Rule ID               | Title                                                    | Severity | Penalty       | Description                                                                    |
| --------------------- | -------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------ |
| `readme-exists`       | Missing README file                                      | info     | 5 per finding | Checks for presence of a README file                                           |
| `license-exists`      | Missing LICENSE file                                     | info     | 3 per finding | Checks for presence of a LICENSE file                                          |
| `contributing-exists` | Missing CONTRIBUTING file                                | info     | 1 per finding | Checks for presence of a CONTRIBUTING file                                     |
| `code-of-conduct`     | Missing CODE_OF_CONDUCT file                             | info     | 1 per finding | Checks for presence of a CODE_OF_CONDUCT file                                  |
| `changelog-exists`    | Missing CHANGELOG file                                   | warning  | 2 per finding | Checks for presence of a CHANGELOG file                                        |
| `ci-workflow`         | Missing CI/CD workflow                                   | warning  | 3 per finding | Checks for CI workflow configuration (GitHub Actions, GitLab CI, etc.)         |
| `lockfile-exists`     | Missing lockfile for package manager                     | warning  | 4 per finding | Detects projects without a lockfile for their package manager                  |
| `env-documented`      | Environment variables not documented                     | info     | 3 per finding | Checks if env vars are documented via `.env.example` or README                 |
| `package-metadata`    | Incorrect or missing package.json metadata               | warning  | 2 per field   | Checks name, version, description, license, and repository URL in package.json |
| `broken-scripts`      | Broken or placeholder script definitions in package.json | error    | 3 per finding | Detects echo-based, empty, or placeholder npm scripts                          |

**Why this matters:** Open-source readiness is often overlooked in AI-generated projects. Missing LICENSE, README, and CONTRIBUTING files make it harder for others to use and contribute. Placeholder package names and broken scripts indicate the project was generated without attention to metadata.

**How to fix:** Add README.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, and CHANGELOG.md files. Set up CI/CD. Commit a lockfile. Create a `.env.example`. Populate `package.json` fields with correct values. Replace placeholder npm scripts with real commands.
