# Scoring

## How Scoring Works

The RepoProof score is a measure of repository quality. Scoring is designed to be **transparent**, **deterministic**, and **resistant to single-rule domination**.

1. **Start at 100 points.**
2. Each finding applies a **penalty** determined by its rule's `scorePenalty` value.
3. Penalties are grouped by **category**, and each category has a **maximum cap**.
4. The final score is `100 - sum of all capped category losses`.

### Category Caps

Each category contributes a maximum possible score. Penalties within a category are capped to prevent a single noisy rule from destroying the overall score.

| Category                     | Max Score | Cap Penalty At |
| ---------------------------- | --------- | -------------- |
| Incomplete Implementation    | 20        | 20             |
| Tests                        | 20        | 20             |
| Security & Configuration     | 30        | 30             |
| Error Handling & Reliability | 15        | 15             |
| Repository Readiness         | 15        | 15             |
| **Total**                    | **100**   | **100**        |

### Example Calculation

A project with the following penalties:

| Category                     | Raw Penalties | Capped Deduction | Category Score |
| ---------------------------- | ------------- | ---------------- | -------------- |
| Incomplete Implementation    | 14            | 14               | 6 / 20         |
| Tests                        | 8             | 8                | 12 / 20        |
| Security & Configuration     | 45 (capped)   | 30               | 0 / 30         |
| Error Handling & Reliability | 6             | 6                | 9 / 15         |
| Repository Readiness         | 3             | 3                | 12 / 15        |

**Final score:** 100 - (14 + 8 + 30 + 6 + 3) = **39 / 100**

## Grade Scale

| Grade | Score Range | Meaning                                                        |
| ----- | ----------- | -------------------------------------------------------------- |
| A     | 90–100      | Excellent — repository is well-maintained and production-ready |
| B     | 80–89       | Good — minor issues that should be addressed                   |
| C     | 70–79       | Fair — significant issues requiring attention                  |
| D     | 60–69       | Poor — multiple quality concerns                               |
| F     | 0–59        | Failing — critical issues found; needs substantial work        |

## Category Scores

### Incomplete Implementation (max 20)

Flags code that appears unfinished. Penalties come from TODO/FIXME markers, not-implemented stubs, empty functions, placeholder text, commented-out code, and hardcoded mock data.

### Tests (max 20)

Evaluates test suite health. Penalties from disabled/focused tests, missing test files, empty test files, echo-based test scripts, and coverage exclusions.

### Security & Configuration (max 30)

The highest-weighted category. Penalties from hardcoded secrets, tracked `.env` files, unsafe `eval()`, wildcard CORS, debug mode in production config, and missing `.gitignore`.

### Error Handling & Reliability (max 15)

Measures code robustness. Penalties from empty catch blocks, HTTP requests without timeouts, unbounded retry loops, and `process.exit()` in library code.

### Repository Readiness (max 15)

Evaluates project documentation and metadata. Penalties from missing README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG, CI workflow, lockfiles, env documentation, incorrect package metadata, and broken scripts.

## Minimum Score

The default minimum passing score is **70** (grade C). This can be configured:

```jsonc
{
  "minScore": 80, // Require at least 80 to pass
}
```

If the final score is below the minimum, RepoProof exits with code 1.

## Fail Conditions

In addition to the minimum score, you can configure the `failOn` option to fail based on finding severity:

- `"error"` (default) — exits with code 1 if any error-severity finding is present
- `"warning"` — exits with code 1 if any error or warning is present

## Penalty Overrides

Individual rule penalties can be overridden in configuration:

```jsonc
{
  "penaltyOverrides": {
    "todo-fixme": 1, // Reduce penalty for TODOs
    "empty-function": 5, // Increase penalty for empty functions
  },
}
```
