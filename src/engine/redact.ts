export function redactSnippet(snippet: string): string {
  if (!snippet) return snippet;
  return snippet
    .replace(/["'`][^"'`]{4,}["'`]/g, (match) => `${match[0]}[REDACTED]${match[match.length - 1]}`)
    .replace(
      /\b(AKIA[0-9A-Z]{16}|gh[pso]_[A-Za-z0-9]{36,}|sk-[A-Za-z0-9]{20,}|xf-[A-Za-z0-9_-]{20,})\b/g,
      "[REDACTED]",
    )
    .replace(
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      "-----BEGIN PRIVATE KEY-----[REDACTED]-----END PRIVATE KEY-----",
    );
}
