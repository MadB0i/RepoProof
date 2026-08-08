import { describe, it, expect } from "vitest";
import type { GitHubRepositoryInfo } from "./types.js";

describe("types", () => {
  it("should define GitHubRepositoryInfo shape correctly", () => {
    const info: GitHubRepositoryInfo = {
      name: "RepoProof",
      owner: "MadB0i",
      description: "A quality audit CLI",
      defaultBranch: "main",
      primaryLanguage: "TypeScript",
      languages: ["TypeScript"],
      stars: 42,
      forks: 3,
      openIssuesCount: 5,
      license: "MIT",
      archived: false,
      createdAt: "2011-01-26T10:01:12Z",
      updatedAt: "2024-01-01T00:00:00Z",
      pushedAt: "2024-02-15T12:00:00Z",
    };
    expect(info.owner).toBe("MadB0i");
    expect(info.languages).toContain("TypeScript");
  });

  it("should allow optional fields to be null", () => {
    const info: GitHubRepositoryInfo = {
      name: "RepoProof",
      owner: "MadB0i",
      description: null,
      defaultBranch: "main",
      primaryLanguage: null,
      languages: [],
      stars: 0,
      forks: 0,
      openIssuesCount: 0,
      license: null,
      archived: false,
      createdAt: "2011-01-26T10:01:12Z",
      updatedAt: "2024-01-01T00:00:00Z",
      pushedAt: "2024-02-15T12:00:00Z",
    };
    expect(info.description).toBeNull();
    expect(info.primaryLanguage).toBeNull();
  });
});
