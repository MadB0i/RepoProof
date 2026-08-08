import { describe, it, expect, vi } from "vitest";
import { GitHubClient } from "./client.js";
import { fetchGitHubRepository } from "./index.js";

const BASE = "https://api.github.example.test";

function repoBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Hello-World",
    owner: { login: "octocat" },
    description: "A test repository",
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 42,
    forks_count: 3,
    open_issues_count: 5,
    license: { spdx_id: "MIT" },
    archived: false,
    created_at: "2011-01-26T10:01:12Z",
    updated_at: "2024-01-01T00:00:00Z",
    pushed_at: "2024-02-15T12:00:00Z",
    ...overrides,
  };
}

type RouteMap = Record<"repo" | "languages", Response>;

function makeFetch(routes: RouteMap): typeof fetch {
  const fn = vi.fn(async (input: string | URL) => {
    const url = String(input);
    const key = url.includes("/languages") ? "languages" : "repo";
    return routes[key];
  });
  return fn as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("GitHubClient - successful response", () => {
  it("fetches repository metadata and languages", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody()),
      languages: jsonResponse({ TypeScript: 25000, JavaScript: 8000 }),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    const info = await client.getRepository("octocat", "Hello-World");

    expect(info.name).toBe("Hello-World");
    expect(info.owner).toBe("octocat");
    expect(info.description).toBe("A test repository");
    expect(info.defaultBranch).toBe("main");
    expect(info.primaryLanguage).toBe("TypeScript");
    expect(info.languages).toEqual(["TypeScript", "JavaScript"]);
    expect(info.stars).toBe(42);
    expect(info.forks).toBe(3);
    expect(info.openIssuesCount).toBe(5);
    expect(info.license).toBe("MIT");
    expect(info.archived).toBe(false);
    expect(info.createdAt).toBe("2011-01-26T10:01:12Z");
    expect(info.updatedAt).toBe("2024-01-01T00:00:00Z");
    expect(info.pushedAt).toBe("2024-02-15T12:00:00Z");
  });

  it("uses the centralized base URL, User-Agent and Accept header", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody()),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await client.getRepository("octocat", "Hello-World");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = vi.mocked(fetchMock).mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(firstUrl).toBe(`${BASE}/repos/octocat/Hello-World`);
    expect(firstInit.method).toBe("GET");
    const headers = firstInit.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/RepoProof/);
    expect(headers["Accept"]).toBe("application/vnd.github+json");
  });
});

describe("GitHubClient - missing optional fields", () => {
  it("handles missing description, language, and license", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody({ description: null, language: null, license: null })),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    const info = await client.getRepository("octocat", "NoDesc");

    expect(info.description).toBeNull();
    expect(info.primaryLanguage).toBeNull();
    expect(info.license).toBeNull();
    expect(info.languages).toEqual([]);
  });

  it("handles an archived repository", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody({ archived: true })),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    const info = await client.getRepository("octocat", "Old");
    expect(info.archived).toBe(true);
  });

  it("sorts languages by byte size descending", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody()),
      languages: jsonResponse({ Go: 100, Rust: 500, TypeScript: 900 }),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    const info = await client.getRepository("octocat", "Multi");
    expect(info.languages).toEqual(["TypeScript", "Rust", "Go"]);
  });
});

describe("GitHubClient - errors", () => {
  it("throws GitHubApiError with status 404", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ message: "Not Found" }, 404),
      languages: jsonResponse({}, 404),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Missing")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
      message: expect.stringContaining("404"),
    });
  });

  it("throws a rate-limit error on 403 with x-ratelimit-remaining: 0", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ message: "rate limit" }, 403, { "x-ratelimit-remaining": "0" }),
      languages: jsonResponse({}, 403, { "x-ratelimit-remaining": "0" }),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Limited")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 403,
      message: expect.stringContaining("rate limit"),
    });
  });

  it("throws a GitHubApiError for other 403 responses", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ message: "Forbidden" }, 403, { "x-ratelimit-remaining": "30" }),
      languages: jsonResponse({}, 403, { "x-ratelimit-remaining": "30" }),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Denied")).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("403"),
    });
  });

  it("throws on 429 rate limiting", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ message: "Too Many Requests" }, 429),
      languages: jsonResponse({}, 429),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Burst")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("throws a clear error on malformed JSON", async () => {
    const fetchMock = makeFetch({
      repo: new Response("not json at all", { status: 200 }),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Broken")).rejects.toThrow(
      /Malformed GitHub API response/,
    );
  });

  it("throws a clear error on a JSON body missing required fields", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ hello: "world" }),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Weird")).rejects.toThrow(
      /Malformed GitHub API response/,
    );
  });

  it("throws on network failure without leaking request details", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED to api.github.com");
    }) as unknown as typeof fetch;

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await expect(client.getRepository("octocat", "Offline")).rejects.toThrow(
      /Failed to reach GitHub API/,
    );
  });
});

describe("GitHubClient - authentication", () => {
  it("sends the token as a Bearer Authorization header", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody()),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({
      baseUrl: BASE,
      token: "example-token",
      fetchImpl: fetchMock,
    });
    await client.getRepository("octocat", "Hello-World");

    const [, init] = vi.mocked(fetchMock).mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer example-token");
  });

  it("does not send an Authorization header without a token", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody()),
      languages: jsonResponse({}),
    });

    const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
    await client.getRepository("octocat", "Public");

    const [, init] = vi.mocked(fetchMock).mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("reads the token from GITHUB_TOKEN env var", async () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "example-token";
    try {
      const fetchMock = makeFetch({
        repo: jsonResponse(repoBody()),
        languages: jsonResponse({}),
      });

      const client = new GitHubClient({ baseUrl: BASE, fetchImpl: fetchMock });
      await client.getRepository("octocat", "Hello-World");

      const [, init] = vi.mocked(fetchMock).mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer example-token");
    } finally {
      delete process.env.GITHUB_TOKEN;
      if (prev !== undefined) process.env.GITHUB_TOKEN = prev;
    }
  });

  it("never includes the token in error messages or output", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse({ message: "Not Found" }, 404),
      languages: jsonResponse({}, 404),
    });

    const client = new GitHubClient({
      baseUrl: BASE,
      token: "example-token",
      fetchImpl: fetchMock,
    });
    const err = await client.getRepository("octocat", "Hidden").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain("example-token");
  });
});

describe("fetchGitHubRepository - end to end", () => {
  it("parses the CLI input and fetches the repository", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody({ name: "RepoProof", owner: { login: "MadB0i" } })),
      languages: jsonResponse({ TypeScript: 1 }),
    });

    const info = await fetchGitHubRepository("MadB0i/RepoProof", {
      baseUrl: BASE,
      fetchImpl: fetchMock,
    });
    expect(info.name).toBe("RepoProof");
    expect(info.owner).toBe("MadB0i");
    expect(info.defaultBranch).toBe("main");
  });

  it("accepts a github.com URL input", async () => {
    const fetchMock = makeFetch({
      repo: jsonResponse(repoBody({ name: "URLRepo" })),
      languages: jsonResponse({}),
    });

    const info = await fetchGitHubRepository("https://github.com/octocat/URLRepo", {
      baseUrl: BASE,
      fetchImpl: fetchMock,
    });
    expect(info.owner).toBe("octocat");
    expect(info.name).toBe("URLRepo");
  });

  it("rejects invalid input before any network call", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await expect(
      fetchGitHubRepository("not valid", { baseUrl: BASE, fetchImpl: fetchMock }),
    ).rejects.toThrow(/Invalid GitHub repository/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
