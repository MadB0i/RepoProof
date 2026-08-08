const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,61})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

export function parseGitHubRepository(input: string): { owner: string; repo: string } {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid GitHub repository: expected owner/repo or a github.com URL");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Invalid GitHub repository: expected owner/repo or a github.com URL");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return parseUrl(trimmed);
  }

  return parseOwnerSlashRepo(trimmed);
}

function parseUrl(url: string): { owner: string; repo: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }

  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    throw new Error(`Not a GitHub URL: ${url}`);
  }

  const segments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }

  const [owner, repo] = segments;
  if (!OWNER_PATTERN.test(owner)) {
    throw new Error(`Invalid repository owner in URL: ${url}`);
  }
  if (!REPO_PATTERN.test(repo)) {
    throw new Error(`Invalid repository name in URL: ${url}`);
  }

  return { owner, repo };
}

function parseOwnerSlashRepo(input: string): { owner: string; repo: string } {
  const parts = input.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid GitHub repository: expected owner/repo, got: ${input}`);
  }

  const [owner, repo] = parts;
  if (!OWNER_PATTERN.test(owner)) {
    throw new Error(`Invalid repository owner: ${owner}`);
  }
  if (!REPO_PATTERN.test(repo)) {
    throw new Error(`Invalid repository name: ${repo}`);
  }

  return { owner, repo };
}
