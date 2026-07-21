import { Rule, RuleResult, ScanContext } from "../types.js";

const PENALTY = 4;

const LOCKFILE_MAP: Array<{
  condition: (pt: {
    hasPackageJson: boolean;
    hasPyprojectToml: boolean;
    hasRequirementsTxt: boolean;
    hasCargoToml: boolean;
    hasGoMod: boolean;
  }) => boolean;
  lockfiles: string[];
  label: string;
}> = [
  {
    condition: (pt) => pt.hasPackageJson,
    lockfiles: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "pnpm-lock.yml"],
    label: "Node.js/TypeScript",
  },
  {
    condition: (pt) => pt.hasPyprojectToml || pt.hasRequirementsTxt,
    lockfiles: ["poetry.lock", "Pipfile.lock", "requirements.txt"],
    label: "Python",
  },
  {
    condition: (pt) => pt.hasCargoToml,
    lockfiles: ["Cargo.lock"],
    label: "Rust",
  },
  {
    condition: (pt) => pt.hasGoMod,
    lockfiles: ["go.sum"],
    label: "Go",
  },
];

const rule: Rule = {
  id: "lockfile-exists",
  title: "Missing lockfile for package manager",
  description:
    "Detects projects that are missing a lockfile for their detected package manager, which can lead to inconsistent dependency installations.",
  severity: "warning",
  category: "repository-readiness",
  scorePenalty: PENALTY,
  docUrl: "https://repoproof.dev/docs/rules/lockfile-exists",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const pt = context.projectType;

      // Determine relevant lockfiles based on project type
      const relevantConfigs = LOCKFILE_MAP.filter((entry) => entry.condition(pt));

      if (relevantConfigs.length === 0) return [];

      // Check if lockfile is present (via scanned files or project type detection)
      if (pt.hasLockfile) return [];

      const hasAnyLockfile = context.files.some((f) => {
        const rp = f.relativePath;
        return relevantConfigs.some((entry) =>
          entry.lockfiles.some((lf) => rp === lf || rp.endsWith("/" + lf)),
        );
      });

      if (hasAnyLockfile) return [];

      const labels = relevantConfigs.map((e) => e.label).join("/");

      return [
        {
          id: this.id,
          title: this.title,
          description: `Missing lockfile for ${labels} project`,
          severity: "warning",
          category: "repository-readiness",
          evidence: [],
          remediation: `Generate and commit a lockfile for your package manager.`,
          scorePenalty: PENALTY,
          docUrl: this.docUrl,
        },
      ];
    } catch {
      return [];
    }
  },
};

export { rule };
