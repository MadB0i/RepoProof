import { GitHubLanguages, GitHubRepoRaw, GitHubRepositoryInfo } from "./types.js";

export const GITHUB_API_BASE_URL = "https://api.github.com";
export const GITHUB_API_ACCEPT_HEADER = "application/vnd.github+json";
export const GITHUB_TOKEN_ENV = "GITHUB_TOKEN";

type FetchLike = typeof fetch;

export interface GitHubClientOptions {
  baseUrl?: string;
  token?: string;
  fetchImpl?: FetchLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: GitHubClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? GITHUB_API_BASE_URL).replace(/\/+$/, "");
    this.token =
      options.token !== undefined ? options.token : (process.env[GITHUB_TOKEN_ENV] ?? undefined);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryInfo> {
    const [repoData, languagesData] = await Promise.all([
      this.fetchJson<unknown>(`/repos/${this.encode(owner)}/${this.encode(repo)}`),
      this.fetchJson<unknown>(`/repos/${this.encode(owner)}/${this.encode(repo)}/languages`),
    ]);

    if (!isGitHubRepoData(repoData)) {
      throw new Error("Malformed GitHub API response: missing repository fields");
    }
    if (!isGitHubLanguages(languagesData)) {
      throw new Error("Malformed GitHub API response: missing languages data");
    }

    return {
      name: repoData.name,
      owner: repoData.owner?.login ?? owner,
      description: repoData.description ?? null,
      defaultBranch: repoData.default_branch,
      primaryLanguage: repoData.language ?? null,
      languages: this.sortLanguages(languagesData),
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssuesCount: repoData.open_issues_count,
      license: repoData.license?.spdx_id ?? null,
      archived: Boolean(repoData.archived),
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
    };
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: GITHUB_API_ACCEPT_HEADER,
          "User-Agent": "RepoProof CLI (local-first repository auditor)",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      });
    } catch (err) {
      throw new Error(`Failed to reach GitHub API: ${(err as Error).message ?? "network error"}`);
    }

    if (response.status === 404) {
      throw new GitHubApiError(
        "GitHub repository not found (HTTP 404): the repository does not exist or is private",
        404,
      );
    }

    if (response.status === 401) {
      throw new GitHubApiError(
        "GitHub API authentication failed (HTTP 401): check that GITHUB_TOKEN is valid",
        401,
      );
    }

    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        throw new GitHubApiError(
          "GitHub API rate limit exceeded (HTTP 403): wait for the rate limit window or set GITHUB_TOKEN",
          403,
        );
      }
      throw new GitHubApiError(
        "GitHub API access denied (HTTP 403): the repository or token may not permit access",
        403,
      );
    }

    if (response.status === 429) {
      throw new GitHubApiError(
        "GitHub API rate limit exceeded (HTTP 429): wait for the rate limit window or set GITHUB_TOKEN",
        429,
      );
    }

    if (!response.ok) {
      throw new GitHubApiError(
        `GitHub API request failed (HTTP ${response.status})`,
        response.status,
      );
    }

    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      throw new Error(
        `Failed to read GitHub API response: ${(err as Error).message ?? "read error"}`,
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Malformed GitHub API response: expected JSON");
    }

    return data as T;
  }

  private encode(value: string): string {
    return encodeURIComponent(value);
  }

  private sortLanguages(languages: GitHubLanguages): string[] {
    return Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }
}

export function isGitHubRepoData(value: unknown): value is GitHubRepoRaw {
  if (!isRecord(value)) return false;
  if (typeof value.name !== "string") return false;
  if (!isRecord(value.owner) || typeof value.owner.login !== "string") return false;
  if (typeof value.default_branch !== "string") return false;
  if (typeof value.stargazers_count !== "number") return false;
  if (typeof value.forks_count !== "number") return false;
  if (typeof value.open_issues_count !== "number") return false;
  if (typeof value.archived !== "boolean") return false;
  if (typeof value.created_at !== "string") return false;
  return true;
}

export function isGitHubLanguages(value: unknown): value is GitHubLanguages {
  return isRecord(value) && Object.values(value).every((v) => typeof v === "number");
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toISOString().slice(0, 10);
}
