export type Severity = "error" | "warning" | "info";
export type Category =
  | "incomplete-implementation"
  | "tests"
  | "security-configuration"
  | "error-handling-reliability"
  | "repository-readiness";

export interface RuleEvidence {
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface RuleResult {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: Category;
  evidence: RuleEvidence[];
  remediation: string;
  scorePenalty: number;
  docUrl: string;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: Category;
  scorePenalty: number;
  docUrl: string;
  run(context: ScanContext): Promise<RuleResult[]>;
}

export interface ScanContext {
  files: ScannedFile[];
  config: RepoProofConfig;
  projectType: ProjectType;
}

export interface ScannedFile {
  path: string;
  relativePath: string;
  content: string;
  size: number;
}

export interface ProjectType {
  languages: string[];
  hasPackageJson: boolean;
  hasTsconfig: boolean;
  hasPyprojectToml: boolean;
  hasRequirementsTxt: boolean;
  hasCargoToml: boolean;
  hasGoMod: boolean;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasReadme: boolean;
  hasLicense: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasChangelog: boolean;
  hasCiWorkflow: boolean;
  hasGitignore: boolean;
  hasLockfile: boolean;
  hasTestDir: boolean;
  hasEnvExample: boolean;
  hasEditorConfig: boolean;
}

export interface RepoProofConfig {
  ignoredPaths?: string[];
  disabledRules?: string[];
  severityOverrides?: Record<string, Severity>;
  penaltyOverrides?: Record<string, number>;
  minScore?: number;
  maxFileSize?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  maxDirectoryDepth?: number;
  includedPaths?: string[];
  excludedPaths?: string[];
  failOn?: "error" | "warning";
}

export interface ScanReport {
  version: string;
  timestamp: string;
  score: number;
  grade: string;
  maxScore: number;
  projectType: ProjectType;
  categoryScores: Record<Category, { score: number; maxScore: number; findings: number }>;
  findings: RuleResult[];
  config: RepoProofConfig;
  summary: {
    totalFindings: number;
    errors: number;
    warnings: number;
    info: number;
    passedChecks: number;
  };
}

export const SOURCE_CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".rb",
  ".php",
  ".cs",
  ".kt",
  ".swift",
  ".sh",
  ".bash",
  ".zsh",
]);

export interface OutputFormat {
  format: "text" | "json" | "markdown" | "html" | "sarif";
  outputPath?: string;
  minScore?: number;
  failOn?: "error" | "warning";
  noColor?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export function calculateGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
