export interface GitHubOwner {
  login: string;
}

export interface GitHubLicense {
  spdx_id: string | null;
}

export interface GitHubRepoRaw {
  name: string;
  owner: GitHubOwner;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: GitHubLicense | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export type GitHubLanguages = Record<string, number>;

export interface GitHubRepositoryInfo {
  name: string;
  owner: string;
  description: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: string[];
  stars: number;
  forks: number;
  openIssuesCount: number;
  license: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}
