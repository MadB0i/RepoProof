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

export function generateHtmlReport(report: ScanReport): string {
  const { errors, warnings, info } = getResultsBySeverity(report.findings);

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
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RepoProof - Quality Audit Report</title>
<style>
  :root {
    --color-bg: #ffffff;
    --color-surface: #f8f9fa;
    --color-border: #dee2e6;
    --color-text: #212529;
    --color-text-secondary: #6c757d;
    --color-pass: #2d8a4e;
    --color-pass-bg: #e8f5e9;
    --color-warn: #b8860b;
    --color-warn-bg: #fff8e1;
    --color-fail: #c62828;
    --color-fail-bg: #ffebee;
    --color-info: #1565c0;
    --color-info-bg: #e3f2fd;
    --color-card-shadow: rgba(0,0,0,0.08);
    --color-table-stripe: #f8f9fa;
    --color-table-hover: #e9ecef;
    --radius: 8px;
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  [data-theme="dark"] {
    --color-bg: #1a1a2e;
    --color-surface: #16213e;
    --color-border: #2a2a4a;
    --color-text: #e0e0e0;
    --color-text-secondary: #a0a0b0;
    --color-pass: #4caf50;
    --color-pass-bg: #1b3a2b;
    --color-warn: #ffc107;
    --color-warn-bg: #3a3010;
    --color-fail: #ef5350;
    --color-fail-bg: #3a1a1a;
    --color-info: #64b5f6;
    --color-info-bg: #0d2538;
    --color-card-shadow: rgba(0,0,0,0.3);
    --color-table-stripe: #1a1a32;
    --color-table-hover: #222244;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-family);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 0;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: 32px;
  }

  header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .theme-toggle {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    padding: 8px 16px;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s, border-color 0.2s;
  }

  .theme-toggle:hover {
    background: var(--color-table-hover);
  }

  /* Score overview */
  .score-overview {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;
    align-items: center;
    justify-content: center;
    padding: 32px 0;
    margin-bottom: 32px;
  }

  .score-ring {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .score-ring svg { transform: rotate(-90deg); }

  .score-ring .bg { fill: none; stroke: var(--color-border); stroke-width: 8; }
  .score-ring .fg {
    fill: none;
    stroke: ${scoreColor};
    stroke-width: 8;
    stroke-linecap: round;
    stroke-dasharray: ${scoreCircumf};
    stroke-dashoffset: ${scoreCircumf - (report.score / 100) * scoreCircumf};
    transition: stroke-dashoffset 1s ease;
  }

  .score-ring .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }

  .score-ring .score-value {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
    color: var(--color-text);
  }

  .score-ring .score-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .score-grade {
    font-size: 4rem;
    font-weight: 800;
    line-height: 1;
    color: ${scoreColor};
  }

  .score-meta {
    text-align: center;
  }

  .score-meta .total-findings {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  /* Summary cards */
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
  }

  .summary-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    text-align: center;
  }

  .summary-card .count {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .summary-card .label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-card.error .count { color: var(--color-fail); }
  .summary-card.warning .count { color: var(--color-warn); }
  .summary-card.info .count { color: var(--color-info); }
  .summary-card.passed .count { color: var(--color-pass); }

  /* Category cards */
  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .category-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    transition: box-shadow 0.2s, transform 0.2s;
  }

  .category-card:hover {
    box-shadow: 0 4px 12px var(--color-card-shadow);
    transform: translateY(-1px);
  }

  .category-card h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--color-text);
  }

  .category-card .progress-bar {
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .category-card .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease;
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
    font-weight: 700;
    color: var(--color-text);
  }

  /* Filters */
  .filters {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px 20px;
    margin-bottom: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
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
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .filters select {
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
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
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .findings-count {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 400;
  }

  .findings-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  table.findings {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  table.findings th {
    text-align: left;
    padding: 10px 12px;
    background: var(--color-surface);
    border-bottom: 2px solid var(--color-border);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  table.findings th.sorted-asc::after { content: " \\25B2"; font-size: 0.625rem; }
  table.findings th.sorted-desc::after { content: " \\25BC"; font-size: 0.625rem; }

  table.findings td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  table.findings tr:nth-child(even) { background: var(--color-table-stripe); }
  table.findings tr:hover { background: var(--color-table-hover); }

  .severity-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .severity-badge.error { background: var(--color-fail-bg); color: var(--color-fail); }
  .severity-badge.warning { background: var(--color-warn-bg); color: var(--color-warn); }
  .severity-badge.info { background: var(--color-info-bg); color: var(--color-info); }

  .finding-id {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.8125rem;
  }

  .finding-title {
    font-weight: 600;
  }

  .finding-location {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.75rem;
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
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
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
    <h1>RepoProof &mdash; Repository Quality Audit</h1>
    <div class="header-controls">
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode">
        <span id="themeIcon">&#9790;</span> <span id="themeLabel">Dark</span>
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
      <div class="score-ring" role="img" aria-label="Score: ${report.score.toFixed(1)} out of 100">
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
  var theme = localStorage.getItem("repoproof-theme") || "light";
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeUI(theme);

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function() {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("repoproof-theme", next);
      updateThemeUI(next);
    });
  }

  function updateThemeUI(t) {
    var icon = document.getElementById("themeIcon");
    var label = document.getElementById("themeLabel");
    if (!icon || !label) return;
    if (t === "dark") {
      icon.innerHTML = "\\2600";
      label.textContent = "Light";
    } else {
      icon.innerHTML = "\\263E";
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
  var defaultTh = document.querySelector("th[data-sort=\"severity\"]");
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
