# GitHub Action

RepoProof integrates with GitHub Actions as a quality gate. The recommended approach is to use `npx` directly — no custom action is required.

## Basic Workflow

```yaml
name: RepoProof Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: npx repoproof scan .
```

## Workflow with HTML Report Upload

```yaml
name: RepoProof Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install -g repoproof
      - run: repoproof scan . --format html --output .repoproof/report.html
      - uses: actions/upload-artifact@v4
        with:
          name: repoproof-report
          path: .repoproof/report.html
```

## Workflow with SARIF for GitHub Code Scanning

```yaml
name: RepoProof Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx repoproof scan . --format sarif --output results.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

## Score Badge

Generate a dynamic score badge using GitHub Actions and shields.io:

```yaml
name: RepoProof Badge
on:
  push:
    branches: [main]

jobs:
  badge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run RepoProof
        id: repoproof
        run: |
          score=$(npx repoproof scan . --format json --quiet | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const r=JSON.parse(d);console.log(r.score)})")
          echo "score=$score" >> $GITHUB_OUTPUT
          color="red"
          if [ "$score" -ge 90 ]; then color="brightgreen"
          elif [ "$score" -ge 80 ]; then color="green"
          elif [ "$score" -ge 70 ]; then color="yellowgreen"
          elif [ "$score" -ge 60 ]; then color="yellow"
          fi
          echo "color=$color" >> $GITHUB_OUTPUT
      - name: Update Badge
        uses: schneegans/dynamic-badges-action@v1.7.0
        with:
          auth: ${{ secrets.GIST_SECRET }}
          gistID: YOUR_GIST_ID
          filename: repoproof-score.json
          label: RepoProof
          message: ${{ steps.repoproof.outputs.score }}/100
          color: ${{ steps.repoproof.outputs.color }}
```

Add the badge to your README:

```markdown
![RepoProof Score](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_USERNAME/YOUR_GIST_ID/raw/repoproof-score.json)
```

## Configuration File

Commit a `.repoproof.jsonc` file to your repository for consistent configuration across local and CI runs:

```jsonc
{
  "minScore": 75,
  "failOn": "warning",
  "ignoredPaths": ["dist", "coverage"],
}
```
