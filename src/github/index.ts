import { GitHubClient, GitHubClientOptions } from "./client.js";
import { parseGitHubRepository } from "./parser.js";
import { GitHubRepositoryInfo } from "./types.js";

export { GitHubClient, GITHUB_API_BASE_URL, GITHUB_TOKEN_ENV, GitHubApiError } from "./client.js";
export { parseGitHubRepository } from "./parser.js";
export type { GitHubRepositoryInfo, GitHubRepoRaw, GitHubLanguages } from "./types.js";

export async function fetchGitHubRepository(
  input: string,
  clientOptions: GitHubClientOptions = {},
): Promise<GitHubRepositoryInfo> {
  const { owner, repo } = parseGitHubRepository(input);
  const client = new GitHubClient(clientOptions);
  return client.getRepository(owner, repo);
}
