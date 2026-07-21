import { Rule, RuleResult, ScanContext } from "../types.js";

const MAX_PENALTY = 8;
const PENALTY_PER_FIELD = 2;

const PLACEHOLDER_NAMES = [
  "my-project",
  "myapp",
  "my-app",
  "sample",
  "test",
  "example",
  "project-name",
  "npm-package",
  "your-package-name",
];

function isSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version);
}

const rule: Rule = {
  id: "package-metadata",
  title: "Incorrect or missing package.json metadata",
  description:
    "Checks for correct package.json metadata including name, version, description, license, and repository URL.",
  severity: "warning",
  category: "repository-readiness",
  scorePenalty: PENALTY_PER_FIELD,
  docUrl: "https://repoproof.dev/docs/rules/package-metadata",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const pkgFile = context.files.find((f) => f.relativePath === "package.json");
      if (!pkgFile) return [];

      let pkg: Record<string, unknown>;
      try {
        pkg = JSON.parse(pkgFile.content);
      } catch {
        return [];
      }

      const issues: string[] = [];

      // Check name
      const name = pkg.name as string | undefined;
      if (!name || name.trim().length === 0) {
        issues.push("Missing package name");
      } else if (PLACEHOLDER_NAMES.includes(name.toLowerCase())) {
        issues.push(`Placeholder package name: "${name}"`);
      }

      // Check version
      const version = pkg.version as string | undefined;
      if (!version || version.trim().length === 0) {
        issues.push("Missing package version");
      } else if (!isSemver(version)) {
        issues.push(`Invalid semver version: "${version}"`);
      }

      // Check description
      const description = pkg.description as string | undefined;
      if (!description || description.trim().length === 0) {
        issues.push("Missing package description");
      }

      // Check license
      const license = pkg.license as string | undefined;
      if (!license || license.trim().length === 0) {
        issues.push("Missing package license");
      }

      // Check repository URL
      const repo = pkg.repository as Record<string, unknown> | string | undefined;
      if (!repo) {
        issues.push("Missing repository URL");
      } else if (typeof repo === "string") {
        if (repo.trim().length === 0) issues.push("Missing repository URL");
      } else if (typeof repo === "object") {
        const url = (repo as Record<string, unknown>).url as string | undefined;
        if (!url || url.trim().length === 0) issues.push("Missing repository URL");
      }

      if (issues.length === 0) return [];

      const penalty = Math.min(issues.length * PENALTY_PER_FIELD, MAX_PENALTY);

      return [
        {
          id: this.id,
          title: this.title,
          description: `${issues.length} metadata issue(s) found: ${issues.join("; ")}`,
          severity: "warning",
          category: "repository-readiness",
          evidence: issues.map((issue) => ({
            file: "package.json",
            snippet: issue,
          })),
          remediation: "Fix the package.json metadata fields listed above.",
          scorePenalty: penalty,
          docUrl: this.docUrl,
        },
      ];
    } catch {
      return [];
    }
  },
};

export { rule };
