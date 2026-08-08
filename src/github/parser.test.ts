import { describe, it, expect } from "vitest";
import { parseGitHubRepository } from "./parser.js";

describe("parseGitHubRepository - owner/repo", () => {
  it("parses a simple owner/repo identifier", () => {
    expect(parseGitHubRepository("octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseGitHubRepository("  octocat/Hello-World  ")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("allows hyphens, underscores and dots in owner and repo", () => {
    expect(parseGitHubRepository("my_org.tld/my.repo-name")).toEqual({
      owner: "my_org.tld",
      repo: "my.repo-name",
    });
  });
});

describe("parseGitHubRepository - URLs", () => {
  it("parses a canonical github.com URL", () => {
    expect(parseGitHubRepository("https://github.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("parses a www.github.com URL", () => {
    expect(parseGitHubRepository("https://www.github.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("parses a URL with trailing slash", () => {
    expect(parseGitHubRepository("https://github.com/octocat/Hello-World/")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("parses URLs with query strings", () => {
    expect(parseGitHubRepository("https://github.com/octocat/Hello-World?tab=readme")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });
});

describe("parseGitHubRepository - invalid identifiers", () => {
  it("rejects empty input", () => {
    expect(() => parseGitHubRepository("")).toThrow(/Invalid GitHub repository/);
  });

  it("rejects whitespace-only input", () => {
    expect(() => parseGitHubRepository("   ")).toThrow(/Invalid GitHub repository/);
  });

  it("rejects missing repo component", () => {
    expect(() => parseGitHubRepository("octocat")).toThrow(/expected owner\/repo/);
  });

  it("rejects three-part identifiers", () => {
    expect(() => parseGitHubRepository("a/b/c")).toThrow(/expected owner\/repo/);
  });

  it("rejects empty owner", () => {
    expect(() => parseGitHubRepository("/Hello-World")).toThrow(/expected owner\/repo/);
  });

  it("rejects empty repo", () => {
    expect(() => parseGitHubRepository("octocat/")).toThrow(/expected owner\/repo/);
  });

  it("rejects spaces inside the identifier", () => {
    expect(() => parseGitHubRepository("octocat/Hello World")).toThrow(/Invalid repository name/);
  });

  it("rejects a github.com URL with too many segments", () => {
    expect(() => parseGitHubRepository("https://github.com/a/b/c")).toThrow(
      /Invalid GitHub repository URL/,
    );
  });

  it("rejects a github.com URL with one segment", () => {
    expect(() => parseGitHubRepository("https://github.com/only-owner")).toThrow(
      /Invalid GitHub repository URL/,
    );
  });

  it("rejects a non-github.com URL", () => {
    expect(() => parseGitHubRepository("https://gitlab.com/octocat/Hello-World")).toThrow(
      /Not a GitHub URL/,
    );
  });

  it("rejects a malformed URL", () => {
    expect(() => parseGitHubRepository("https://github.com/a b/c")).toThrow(
      /Invalid repository owner in URL/,
    );
  });

  it("rejects an invalid owner in URL form", () => {
    expect(() => parseGitHubRepository("https://github.com/-bad/repo")).toThrow(
      /Invalid repository owner/,
    );
  });
});
