export interface ProgressOptions {
  format?: string;
  quiet?: boolean;
  progress?: boolean;
}

/**
 * Whether to emit scan progress on stderr. Auto-enabled for interactive
 * text scans; never on stdout so JSON/SARIF output stays parseable.
 */
export function shouldShowProgress(options: ProgressOptions, isTty: boolean): boolean {
  if (options.progress === true) return true;
  if (options.quiet) return false;
  return isTty && (options.format ?? "text") === "text";
}

export function formatProgressMessage(fileCount: number, ruleCount: number): string {
  return `Scanning... ${fileCount} file(s), ${ruleCount} rule(s)`;
}
