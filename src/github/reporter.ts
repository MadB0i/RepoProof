import { GitHubRepositoryInfo } from "./types.js";
import { formatDate } from "./client.js";

export interface GitHubReporterOptions {
  noColor?: boolean;
}

function bold(text: string, noColor: boolean): string {
  return noColor ? text : `\x1B[1m${text}\x1B[22m`;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function generateGitHubSummary(
  info: GitHubRepositoryInfo,
  options: GitHubReporterOptions = {},
): string {
  const { noColor = false } = options;
  const lines: string[] = [];

  lines.push("");
  lines.push(bold("RepoProof \u2014 GitHub", noColor));
  lines.push("");
  lines.push(`  Repository:   ${info.owner}/${info.name}`);
  if (info.description) {
    lines.push(`  Description:  ${info.description}`);
  }
  lines.push(`  Default Branch: ${info.defaultBranch}`);
  lines.push(`  Primary Language: ${info.primaryLanguage ?? "n/a"}`);
  if (info.languages.length > 0) {
    lines.push(`  Languages:    ${info.languages.join(", ")}`);
  }
  lines.push(`  Stars:        ${info.stars}`);
  lines.push(`  Forks:        ${info.forks}`);
  lines.push(`  Open Issues:  ${info.openIssuesCount}`);
  lines.push(`  License:      ${info.license ?? "n/a"}`);
  lines.push(`  Archived:     ${yesNo(info.archived)}`);
  lines.push(`  Created:      ${formatDate(info.createdAt)}`);
  lines.push(`  Updated:      ${formatDate(info.updatedAt)}`);
  lines.push(`  Last Push:    ${formatDate(info.pushedAt)}`);
  lines.push("");

  return lines.join("\n");
}
