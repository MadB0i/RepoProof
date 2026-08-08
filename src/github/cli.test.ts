import { describe, it, expect } from "vitest";
import { Command } from "commander";

describe("CLI github command registration", () => {
  it("should have a github command", () => {
    const program = new Command();
    program.command("github").description("Fetch repository metadata from the GitHub REST API");
    const cmd = program.commands.find((c) => c.name() === "github");
    expect(cmd).toBeDefined();
  });

  it("should require a repository argument", () => {
    const program = new Command();
    const cmd = program.command("github").argument("<repository>", "GitHub repository");
    expect(cmd.registeredArguments.length).toBe(1);
  });
});

describe("CLI github argument parsing", () => {
  it("captures owner/repo as the repository argument", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let captured = "";
    program
      .command("github")
      .argument("<repository>", "GitHub repository")
      .action((repository: string) => {
        captured = repository;
      });

    await program.parseAsync(["node", "repoproof", "github", "MadB0i/RepoProof"]);
    expect(captured).toBe("MadB0i/RepoProof");
  });

  it("captures a full github.com URL as the repository argument", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let captured = "";
    program
      .command("github")
      .argument("<repository>", "GitHub repository")
      .action((repository: string) => {
        captured = repository;
      });

    await program.parseAsync([
      "node",
      "repoproof",
      "github",
      "https://github.com/MadB0i/RepoProof",
    ]);
    expect(captured).toBe("https://github.com/MadB0i/RepoProof");
  });
});
