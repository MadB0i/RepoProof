import { ScanReport, Category } from "../types.js";
import { getResultsBySeverity } from "../engine/rule-runner.js";
import { redactSnippet } from "../engine/redact.js";

const CATEGORY_LABELS: Record<Category, string> = {
  "incomplete-implementation": "Incomplete Implementation",
  tests: "Tests",
  "security-configuration": "Security Configuration",
  "error-handling-reliability": "Error Handling & Reliability",
  "repository-readiness": "Repository Readiness",
};

const CATEGORY_ORDER: Category[] = [
  "incomplete-implementation",
  "tests",
  "security-configuration",
  "error-handling-reliability",
  "repository-readiness",
];

const SEVERITY_LABELS: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface HtmlReportOptions {
  targetLabel?: string;
  targetKind?: "local" | "github";
}

function getDisplayTargetLabel(targetLabel: string, targetKind?: "local" | "github"): string {
  if (targetKind !== "local") return targetLabel;
  const normalized = targetLabel.replace(/[\\/]+$/, "");
  const lastSegment = normalized.split(/[\\/]/).filter(Boolean).pop();
  return lastSegment || targetLabel;
}

export function generateHtmlReport(report: ScanReport, options?: HtmlReportOptions): string {
  const { errors, warnings, info } = getResultsBySeverity(report.findings);
  const targetLabel = options?.targetLabel?.trim() || "Local repository";
  const displayTargetLabel = getDisplayTargetLabel(targetLabel, options?.targetKind);
  const safeTargetLabel = escapeHtml(displayTargetLabel);
  const reportTitle = `${targetLabel} — RepoProof Audit`;

  const categories = CATEGORY_ORDER.map((cat) => {
    const cs = report.categoryScores[cat];
    return { key: cat, label: CATEGORY_LABELS[cat], ...cs };
  });

  const scoreColor =
    report.score >= 80
      ? "var(--color-pass)"
      : report.score >= 60
        ? "var(--color-warn)"
        : "var(--color-fail)";
  const scoreCircumf = 2 * Math.PI * 54;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(reportTitle)}</title>
<style>
  :root {
    --color-bg: #14161C;
    --color-surface: #1B1E27;
    --color-surface-strong: #20232D;
    --color-border: #2A2E3A;
    --color-text: #E8EAF0;
    --color-text-secondary: #8B90A3;
    --color-accent: #00D9C0;
    --color-accent-dim: #087F77;
    --color-pass: #63D6A5;
    --color-pass-bg: #17352D;
    --color-warn: #F5B942;
    --color-warn-bg: #3A3010;
    --color-fail: #FF5D5D;
    --color-fail-bg: #3A1A22;
    --color-info: #64B5F6;
    --color-info-bg: #122D40;
    --color-card-shadow: none;
    --color-table-stripe: #181B23;
    --color-table-hover: #232733;
    --radius: 3px;
    --font-family: "IBM Plex Sans", "Trebuchet MS", sans-serif;
    --font-display: "Space Grotesk", "Trebuchet MS", sans-serif;
    --font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  }

  [data-theme="light"] {
    --color-bg: #F4F6F8;
    --color-surface: #FFFFFF;
    --color-surface-strong: #EEF1F4;
    --color-border: #D6DCE3;
    --color-text: #171B22;
    --color-text-secondary: #5C6675;
    --color-accent: #007F78;
    --color-accent-dim: #B5E8E2;
    --color-pass: #17845E;
    --color-pass-bg: #DDF4E9;
    --color-warn: #9A6800;
    --color-warn-bg: #FFF0C7;
    --color-fail: #C53D4B;
    --color-fail-bg: #FFE1E5;
    --color-info: #216DB0;
    --color-info-bg: #DCEEFF;
    --color-table-stripe: #F8FAFB;
    --color-table-hover: #E8EEF2;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-family);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.5;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  .container { max-width: 1440px; margin: 0; padding: 28px 32px 40px; }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 20px;
    padding: 0 0 18px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 24px;
  }

  .wordmark {
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
    text-transform: uppercase;
  }

  header h1 {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
    margin: 0 0 5px;
  }

  .target-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .target-meta strong { color: var(--color-accent); font-weight: 600; }

  .header-slash { color: var(--color-accent); }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .theme-toggle {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-accent);
    padding: 7px 12px;
    border-radius: var(--radius);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    transition: border-color 0.15s, color 0.15s;
  }

  .theme-toggle:hover { border-color: var(--color-accent); }

  /* Score overview */
  .score-overview {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
    align-items: center;
    justify-content: flex-start;
    padding: 18px 20px;
    margin-bottom: 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-accent);
  }

  .score-ring {
    position: relative;
    width: 112px;
    height: 112px;
    flex: 0 0 auto;
  }

  .score-ring svg { transform: rotate(-90deg); }

  .score-ring .bg { fill: none; stroke: var(--color-border); stroke-width: 6; }
  .score-ring .fg {
    fill: none;
    stroke: ${scoreColor};
    stroke-width: 6;
    stroke-linecap: round;
    stroke-dasharray: var(--gauge-circumference);
    stroke-dashoffset: var(--score-offset);
    animation: gaugeSweep 0.8s ease-out both;
  }

  @keyframes gaugeSweep {
    from { stroke-dashoffset: var(--gauge-circumference); }
    to { stroke-dashoffset: var(--score-offset); }
  }

  .score-ring .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }

  .score-ring .score-value {
    font-family: var(--font-mono);
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
    color: var(--color-text);
  }

  .score-ring .score-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .score-grade {
    font-family: var(--font-mono);
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: ${scoreColor};
  }

  .score-meta {
    font-family: var(--font-mono);
    text-align: left;
    min-width: 150px;
  }

  .score-meta .total-findings {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  /* Summary cards */
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--color-border);
    margin-bottom: 24px;
  }

  .summary-card {
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    padding: 12px 16px;
    text-align: left;
  }

  .summary-card:last-child { border-right: 0; }

  .summary-card .count {
    font-family: var(--font-mono);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .summary-card .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .summary-card.error .count { color: var(--color-fail); }
  .summary-card.warning .count { color: var(--color-warn); }
  .summary-card.info .count { color: var(--color-info); }
  .summary-card.passed .count { color: var(--color-pass); }

  /* Category cards */
  .category-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    margin-bottom: 24px;
  }

  .category-card {
    background: var(--color-surface);
    border: 0;
    border-radius: 0;
    padding: 14px;
  }

  .category-card h3 {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--color-text);
  }

  .category-card .progress-bar {
    height: 5px;
    background: var(--color-border);
    border-radius: 0;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .category-card .progress-fill {
    height: 100%;
    border-radius: 0;
    transition: width 0.3s ease;
  }

  .category-card .progress-fill.pass { background: var(--color-pass); }
  .category-card .progress-fill.warn { background: var(--color-warn); }
  .category-card .progress-fill.fail { background: var(--color-fail); }

  .category-card .cat-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .category-card .cat-score {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--color-text);
  }

  /* Filters */
  .filters {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-accent);
    border-radius: 0;
    padding: 12px 14px;
    margin-bottom: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
  }

  .filters label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .filters input[type="search"] {
    flex: 1;
    min-width: 180px;
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .filters select {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.75rem;
  }

  .severity-filters {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .severity-filters label {
    font-weight: 400;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .severity-filters input[type="checkbox"] {
    cursor: pointer;
  }

  /* Findings table */
  .findings-section h2 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .findings-count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 400;
  }

  .findings-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 0;
  }

  table.findings {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  table.findings th {
    text-align: left;
    padding: 9px 10px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-secondary);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  table.findings th.sorted-asc::after { content: " \\25B2"; font-size: 0.625rem; }
  table.findings th.sorted-desc::after { content: " \\25BC"; font-size: 0.625rem; }

  table.findings td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  table.findings tr:nth-child(even) { background: var(--color-table-stripe); }
  table.findings tr:hover { background: var(--color-table-hover); }

  .severity-badge {
    display: inline-block;
    padding: 3px 7px;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .severity-badge.error { background: var(--color-fail-bg); color: var(--color-fail); }
  .severity-badge.warning { background: var(--color-warn-bg); color: var(--color-warn); }
  .severity-badge.info { background: var(--color-info-bg); color: var(--color-info); }

  .finding-id {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-accent);
  }

  .finding-title {
    font-weight: 600;
  }

  .finding-location {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    word-break: break-all;
  }

  .finding-evidence {
    margin-top: 8px;
    font-size: 0.8125rem;
  }

  .finding-evidence summary {
    cursor: pointer;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .finding-evidence .evidence-content {
    margin-top: 6px;
    padding: 8px 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
  }

  .finding-remediation {
    margin-top: 4px;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .finding-doc {
    font-size: 0.75rem;
  }

  .finding-doc a {
    color: var(--color-info);
    text-decoration: none;
  }

  .finding-doc a:hover {
    text-decoration: underline;
  }

  .empty-state {
    text-align: center;
    padding: 48px 16px;
    color: var(--color-text-secondary);
  }

  .empty-state h3 {
    font-size: 1.125rem;
    margin-bottom: 8px;
    color: var(--color-text);
  }

  footer {
    text-align: center;
    padding: 32px 0;
    border-top: 1px solid var(--color-border);
    margin-top: 32px;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  /* No-findings state */
  .no-findings {
    text-align: center;
    padding: 48px 16px;
  }

  .no-findings .icon {
    font-size: 3rem;
    margin-bottom: 12px;
  }

  .no-findings h2 {
    font-size: 1.25rem;
    margin-bottom: 8px;
  }

  .no-findings p {
    color: var(--color-text-secondary);
  }

  /* Print */
  @media print {
    .theme-toggle, .filters, .header-controls { display: none !important; }
    body { background: #fff; color: #000; }
    .category-card { break-inside: avoid; }
    .score-overview { break-inside: avoid; }
    table.findings tr { break-inside: avoid; }
    .container { max-width: 100%; padding: 0; }
    header { border-bottom-color: #ccc; }
    .findings-table-wrapper { border-color: #ccc; }
    table.findings th { background: #f0f0f0; }
    table.findings tr:nth-child(even) { background: #f8f8f8; }
  }

  @media (max-width: 640px) {
    .score-overview { flex-direction: column; gap: 16px; }
    .score-grade { font-size: 3rem; }
    header { flex-direction: column; align-items: flex-start; }
    .filters { flex-direction: column; align-items: stretch; }
    .severity-filters { flex-wrap: wrap; }
    .category-grid { grid-template-columns: 1fr; }
    .summary-cards { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<div class="container">
  <header role="banner">
    <div>
      <div class="wordmark">RepoProof</div>
      <h1>${safeTargetLabel}</h1>
      <div class="target-meta">
        <span><strong>SCAN</strong> ${escapeHtml(report.timestamp)}</span>
      </div>
    </div>
    <div class="header-controls">
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle color mode" aria-pressed="true">
        <span id="themeIcon">☀</span> <span id="themeLabel">Light</span>
      </button>
    </div>
  </header>

  ${
    report.findings.length === 0
      ? `
  <div class="no-findings">
    <div class="icon">&#10003;</div>
    <h2>All Checks Passed</h2>
    <p>No issues were detected in this repository audit.</p>
  </div>
  `
      : `
  <section aria-label="Score overview">
    <div class="score-overview">
      <div class="score-ring" role="img" aria-label="Score: ${report.score.toFixed(1)} out of 100" style="--gauge-circumference:${scoreCircumf};--score-offset:${scoreCircumf - (report.score / 100) * scoreCircumf}">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle class="bg" cx="60" cy="60" r="54"/>
          <circle class="fg" cx="60" cy="60" r="54"/>
        </svg>
        <div class="center">
          <div class="score-value">${report.score.toFixed(0)}</div>
          <div class="score-label">/ 100</div>
        </div>
      </div>
      <div class="score-grade" aria-label="Grade ${report.grade}">${report.grade}</div>
      <div class="score-meta">
        <div style="font-size:1rem;font-weight:600;">${report.score.toFixed(1)}%</div>
        <div class="total-findings">${report.summary.totalFindings} finding(s) &middot; ${report.summary.passedChecks} check(s) passed</div>
      </div>
    </div>
  </section>

  <section aria-label="Summary statistics">
    <div class="summary-cards">
      <div class="summary-card error">
        <div class="count" id="countError">${errors.length}</div>
        <div class="label">Errors</div>
      </div>
      <div class="summary-card warning">
        <div class="count" id="countWarning">${warnings.length}</div>
        <div class="label">Warnings</div>
      </div>
      <div class="summary-card info">
        <div class="count" id="countInfo">${info.length}</div>
        <div class="label">Info</div>
      </div>
      <div class="summary-card passed">
        <div class="count">${report.summary.passedChecks}</div>
        <div class="label">Passed</div>
      </div>
    </div>
  </section>

  <section aria-label="Category scores">
    <h2 style="font-size:1.125rem;font-weight:700;margin-bottom:12px;">Categories</h2>
    <div class="category-grid">
      ${categories
        .map((cat) => {
          const pct = cat.maxScore > 0 ? (cat.score / cat.maxScore) * 100 : 0;
          const fillClass = pct >= 80 ? "pass" : pct >= 60 ? "warn" : "fail";
          return `
        <div class="category-card" role="region" aria-label="${escapeHtml(cat.label)}">
          <h3>${escapeHtml(cat.label)}</h3>
          <div class="progress-bar" role="progressbar" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <div class="cat-meta">
            <span class="cat-score">${cat.score.toFixed(1)} / ${cat.maxScore}</span>
            <span>${cat.findings} finding(s)</span>
          </div>
        </div>`;
        })
        .join("")}
    </div>
  </section>

  <section class="findings-section" aria-label="Findings">
    <h2>Findings <span class="findings-count" id="visibleCount">${report.findings.length} visible</span></h2>

    <div class="filters" role="search" aria-label="Filter findings">
      <div class="severity-filters">
        <label><input type="checkbox" class="severity-filter" value="error" checked aria-label="Filter errors"> Error</label>
        <label><input type="checkbox" class="severity-filter" value="warning" checked aria-label="Filter warnings"> Warning</label>
        <label><input type="checkbox" class="severity-filter" value="info" checked aria-label="Filter info"> Info</label>
      </div>
      <label>
        Category:
        <select id="categoryFilter" aria-label="Filter by category">
          <option value="">All Categories</option>
          ${CATEGORY_ORDER.map((c) => `<option value="${c}">${escapeHtml(CATEGORY_LABELS[c])}</option>`).join("")}
        </select>
      </label>
      <input type="search" id="searchFilter" placeholder="Search findings..." aria-label="Search findings by keyword">
    </div>

    <div class="findings-table-wrapper">
      <table class="findings" id="findingsTable">
        <thead>
          <tr>
            <th data-sort="severity" aria-sort="none">Severity</th>
            <th data-sort="id" aria-sort="none">Rule ID</th>
            <th data-sort="title" aria-sort="none">Title</th>
            <th data-sort="category" aria-sort="none">Category</th>
            <th data-sort="location" aria-sort="none">Location</th>
            <th data-sort="penalty" aria-sort="none">Penalty</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody id="findingsBody">
          ${report.findings
            .map((f, idx) => {
              const firstEv = f.evidence[0];
              const location = firstEv
                ? `${escapeHtml(firstEv.file)}${firstEv.line != null ? `:${firstEv.line}` : ""}${firstEv.column != null ? `:${firstEv.column}` : ""}`
                : "N/A";
              return `
          <tr data-severity="${f.severity}" data-category="${f.category}" data-idx="${idx}">
            <td><span class="severity-badge ${f.severity}" role="status">${SEVERITY_LABELS[f.severity]}</span></td>
            <td><span class="finding-id">${escapeHtml(f.id)}</span></td>
            <td><span class="finding-title">${escapeHtml(f.title)}</span></td>
            <td>${escapeHtml(CATEGORY_LABELS[f.category] ?? f.category)}</td>
            <td><span class="finding-location">${location}</span></td>
            <td>-${f.scorePenalty}</td>
            <td>
              <details class="finding-evidence">
                <summary>View details</summary>
                <div class="evidence-content">
                  <strong>Description:</strong> ${escapeHtml(f.description)}
                </div>
                ${
                  f.evidence.length > 0
                    ? `
                <div class="evidence-content" style="margin-top:6px;">
                  <strong>Evidence:</strong>
                  ${f.evidence
                    .map((ev) => {
                      const evLoc = `${escapeHtml(ev.file)}${ev.line != null ? `:${ev.line}` : ""}`;
                      const snippet = ev.snippet ? escapeHtml(redactSnippet(ev.snippet)) : "";
                      return `<div style="margin-top:4px;"><code>${evLoc}</code>${snippet ? `<pre style="margin-top:4px;background:var(--color-surface);padding:8px;border-radius:4px;overflow-x:auto;">${snippet}</pre>` : ""}</div>`;
                    })
                    .join("")}
                </div>`
                    : ""
                }
                <div class="evidence-content finding-remediation" style="margin-top:6px;">
                  <strong>Remediation:</strong> ${escapeHtml(f.remediation)}
                </div>
                ${f.docUrl ? `<div class="evidence-content finding-doc" style="margin-top:4px;"><a href="${escapeHtml(f.docUrl)}" target="_blank" rel="noopener noreferrer">Documentation &nearr;</a></div>` : ""}
              </details>
            </td>
          </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </section>
  `
  }

  <footer role="contentinfo">
    <p>Report generated by <strong>RepoProof v${escapeHtml(report.version)}</strong> on ${escapeHtml(report.timestamp)}</p>
    <p style="margin-top:4px;">License: MIT</p>
  </footer>
</div>

<script>
(function() {
  var storage = null;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  function readTheme() {
    try {
      var stored = storage && storage.getItem("repoproof-theme");
      return stored === "light" || stored === "dark" ? stored : "dark";
    } catch (error) { return "dark"; }
  }
  function saveTheme(theme) {
    try { if (storage) storage.setItem("repoproof-theme", theme); } catch (error) { void error; }
  }
  var theme = readTheme();
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeUI(theme);

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function() {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      saveTheme(next);
      updateThemeUI(next);
    });
  }

  function updateThemeUI(t) {
    var icon = document.getElementById("themeIcon");
    var label = document.getElementById("themeLabel");
    if (themeToggle) themeToggle.setAttribute("aria-pressed", String(t === "dark"));
    if (!icon || !label) return;
    if (t === "dark") {
      icon.textContent = "☀";
      label.textContent = "Light";
    } else {
      icon.textContent = "◐";
      label.textContent = "Dark";
    }
  }

  // Filtering
  var severityCheckboxes = document.querySelectorAll(".severity-filter");
  var categoryFilter = document.getElementById("categoryFilter");
  var searchFilter = document.getElementById("searchFilter");
  var tbody = document.getElementById("findingsBody");
  var visibleCount = document.getElementById("visibleCount");

  function filterRows() {
    if (!tbody) return;
    var selectedSeverities = [];
    severityCheckboxes.forEach(function(cb) {
      if (cb.checked) selectedSeverities.push(cb.value);
    });
    var selectedCategory = categoryFilter ? categoryFilter.value : "";
    var searchTerm = searchFilter ? searchFilter.value.toLowerCase() : "";
    var rows = tbody.querySelectorAll("tr");
    var visible = 0;

    rows.forEach(function(row) {
      var sev = row.getAttribute("data-severity");
      var cat = row.getAttribute("data-category");
      var text = row.textContent.toLowerCase();
      var sevMatch = selectedSeverities.indexOf(sev) !== -1;
      var catMatch = !selectedCategory || cat === selectedCategory;
      var searchMatch = !searchTerm || text.indexOf(searchTerm) !== -1;
      var match = sevMatch && catMatch && searchMatch;
      row.style.display = match ? "" : "none";
      if (match) visible++;
    });

    if (visibleCount) {
      visibleCount.textContent = visible + " visible";
    }
  }

  severityCheckboxes.forEach(function(cb) { cb.addEventListener("change", filterRows); });
  if (categoryFilter) categoryFilter.addEventListener("change", filterRows);
  if (searchFilter) searchFilter.addEventListener("input", filterRows);

  // Sorting
  var sortCol = null;
  var sortDir = "asc";

  document.querySelectorAll("th[data-sort]").forEach(function(th) {
    th.addEventListener("click", function() {
      var key = th.getAttribute("data-sort");
      if (sortCol === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortCol = key;
        sortDir = "asc";
      }

      document.querySelectorAll("th[data-sort]").forEach(function(h) {
        h.classList.remove("sorted-asc", "sorted-desc");
        h.removeAttribute("aria-sort");
      });
      th.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      th.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");

      sortTable(key, sortDir);
    });
  });

  function sortTable(key, dir) {
    if (!tbody) return;
    var rows = Array.from(tbody.querySelectorAll("tr"));
    var multiplier = dir === "asc" ? 1 : -1;

    rows.sort(function(a, b) {
      var aVal, bVal;
      switch (key) {
        case "severity":
          aVal = severityWeight(a.getAttribute("data-severity"));
          bVal = severityWeight(b.getAttribute("data-severity"));
          break;
        case "id":
          aVal = a.querySelector(".finding-id")?.textContent || "";
          bVal = b.querySelector(".finding-id")?.textContent || "";
          break;
        case "title":
          aVal = a.querySelector(".finding-title")?.textContent || "";
          bVal = b.querySelector(".finding-title")?.textContent || "";
          break;
        case "category":
          aVal = a.getAttribute("data-category") || "";
          bVal = b.getAttribute("data-category") || "";
          break;
        case "location":
          aVal = a.querySelector(".finding-location")?.textContent || "";
          bVal = b.querySelector(".finding-location")?.textContent || "";
          break;
        case "penalty":
          var cells = a.querySelectorAll("td");
          aVal = parseFloat(cells[5]?.textContent || "0");
          bVal = parseFloat(b.querySelectorAll("td")[5]?.textContent || "0");
          break;
        default:
          aVal = a.textContent;
          bVal = b.textContent;
      }

      if (typeof aVal === "number") {
        return (aVal - bVal) * multiplier;
      }
      return aVal.localeCompare(bVal) * multiplier;
    });

    rows.forEach(function(row) { tbody.appendChild(row); });
    filterRows();
  }

  function severityWeight(s) {
    if (s === "error") return 3;
    if (s === "warning") return 2;
    return 1;
  }

  // Initial sort by severity desc
  var defaultTh = document.querySelector('th[data-sort="severity"]');
  if (defaultTh) {
    sortCol = "severity";
    sortDir = "desc";
    defaultTh.classList.add("sorted-desc");
    defaultTh.setAttribute("aria-sort", "descending");
    sortTable("severity", "desc");
  }
})();
<\/script>
</body>
</html>`;
}
