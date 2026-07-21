# Report Formats

RepoProof supports five output formats, each designed for a specific use case.

## Text (default)

Clean terminal output with score, grade, severity breakdown, and findings grouped by category.

```bash
npx repoproof scan .                    # default text output
npx repoproof scan . --format text      # explicit
npx repoproof scan . --no-color         # plain text (no ANSI codes)
npx repoproof scan . --quiet            # score and grade only
npx repoproof scan . --verbose          # full detail with evidence
```

**Use cases:** Local development, CI logs, quick feedback.

## JSON

Structured JSON output following the `ScanReport` schema. Suitable for programmatic consumption.

```bash
npx repoproof scan . --format json
npx repoproof scan . --format json --output report.json
```

**Schema:** The JSON output matches the `ScanReport` TypeScript interface:

```json
{
  "version": "1.0.0",
  "timestamp": "2026-07-21T12:00:00.000Z",
  "score": 72,
  "grade": "C",
  "maxScore": 100,
  "projectType": {
    "languages": ["TypeScript"],
    "hasPackageJson": true,
    ...
  },
  "categoryScores": {
    "incomplete-implementation": { "score": 14, "maxScore": 20, "findings": 3 },
    ...
  },
  "findings": [
    {
      "id": "todo-fixme",
      "title": "TODO/FIXME markers in source code",
      "severity": "warning",
      "category": "incomplete-implementation",
      "evidence": [{ "file": "src/main.ts", "line": 42, "snippet": "// TODO: implement" }],
      "scorePenalty": 2
    }
  ],
  "summary": {
    "totalFindings": 12,
    "errors": 3,
    "warnings": 7,
    "info": 2,
    "passedChecks": 19
  }
}
```

**Use cases:** Custom tooling, dashboards, automated quality gates, historical analysis.

## Markdown

GitHub-flavored markdown report suitable for PR comments, issues, or embedded documentation.

```bash
npx repoproof scan . --format markdown
npx repoproof scan . --format markdown --output report.md
```

**Output includes:**

- Score and grade header
- Category scores table with visual bars
- Findings grouped by severity (error, warning, info)
- Evidence snippets with file paths and line numbers

**Use cases:** Posting results to pull requests, including in project documentation, sharing in issues.

## HTML

Self-contained HTML report with interactive features. No external dependencies — everything is inline.

```bash
npx repoproof scan . --format html
npx repoproof scan . --format html --output report.html
```

**Features:**

- Light/dark mode toggle with system preference detection
- Score gauge visualization (animated circular progress)
- Category score cards with progress bars
- Filterable findings table (filter by severity, category, or rule)
- Expandable evidence with code snippets
- Summary statistics header
- Print-friendly layout (hides interactive elements)
- Responsive design for mobile viewing
- Zero external dependencies — single self-contained HTML file

**Use cases:** Sharing results with non-technical stakeholders, archiving reports, visual review.

## SARIF

SARIF 2.1.0 (Static Analysis Results Interchange Format) output compatible with GitHub Code Scanning and other SARIF consumers.

```bash
npx repoproof scan . --format sarif
npx repoproof scan . --format sarif --output results.sarif
```

**Compatible with:**

- GitHub Code Scanning (upload using `github/codeql-action/upload-sarif@v3`)
- Azure DevOps
- Visual Studio
- Any SARIF-compatible tooling

**SARIF output includes:**

- Tool information with version
- Rule metadata (ID, name, description, severity)
- Results with file locations, line numbers, and snippets
- Versioned output (SARIF 2.1.0)
- Proper URI-encoded file paths

```yaml
# Upload to GitHub Code Scanning
- run: npx repoproof scan . --format sarif --output results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

**Use cases:** Integration with GitHub Code Scanning, enterprise SARIF pipelines.
