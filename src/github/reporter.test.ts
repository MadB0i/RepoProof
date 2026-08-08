import { describe, it, expect } from "vitest";
import { generateGitHubSummary } from "./reporter.js";

const info = {
  name: "RepoProof",
  owner: "MadB0i",
  description: "A quality audit CLI",
  defaultBranch: "main",
  primaryLanguage: "TypeScript",
  languages: ["TypeScript", "JavaScript"],
  stars: 42,
  forks: 3,
  openIssuesCount: 5,
  license: "MIT",
  archived: false,
  createdAt: "2011-01-26T10:01:12Z",
  updatedAt: "2024-01-01T00:00:00Z",
  pushedAt: "2024-02-15T12:00:00Z",
};

describe("generateGitHubSummary", () => {
  it("includes the repository identity fields", () => {
    const output = generateGitHubSummary(info, { noColor: true });
    expect(output).toContain("MadB0i/RepoProof");
    expect(output).toContain("A quality audit CLI");
    expect(output).toContain("Default Branch: main");
  });

  it("includes the numeric metadata and license", () => {
    const output = generateGitHubSummary(info, { noColor: true });
    expect(output).toContain("Primary Language: TypeScript");
    expect(output).toContain("Stars:");
    expect(output).toContain("42");
    expect(output).toContain("Forks:");
    expect(output).toContain("3");
    expect(output).toContain("Open Issues:");
    expect(output).toContain("5");
    expect(output).toContain("License:      MIT");
    expect(output).toContain("Archived:     No");
  });

  it("handles missing optional metadata", () => {
    const output = generateGitHubSummary(
      { ...info, description: null, primaryLanguage: null, license: null, archived: true },
      { noColor: true },
    );
    expect(output).toContain("Archived:     Yes");
    expect(output).toContain("License:      n/a");
    expect(output).not.toContain("Description:");
  });

  it("omits the languages line when no languages are present", () => {
    const output = generateGitHubSummary({ ...info, languages: [] }, { noColor: true });
    expect(output).not.toContain("Languages:");
  });

  it("renders human-readable dates", () => {
    const output = generateGitHubSummary(info, { noColor: true });
    expect(output).toContain("Created:      2011-01-26");
    expect(output).toContain("Updated:      2024-01-01");
    expect(output).toContain("Last Push:    2024-02-15");
  });
});
