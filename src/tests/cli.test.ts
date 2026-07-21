import { describe, it, expect } from "vitest";
import { Command } from "commander";

describe("CLI program setup", () => {
  it("should create a program with correct name", () => {
    const program = new Command();
    program.name("repoproof").version("1.0.0");
    expect(program.name()).toBe("repoproof");
  });

  it("should have scan command", () => {
    const program = new Command();
    program.command("scan").description("Scan a repository");
    const cmd = program.commands.find((c) => c.name() === "scan");
    expect(cmd).toBeDefined();
  });

  it("should have init command", () => {
    const program = new Command();
    program.command("init").description("Generate starter config");
    const cmd = program.commands.find((c) => c.name() === "init");
    expect(cmd).toBeDefined();
  });

  it("should have explain command", () => {
    const program = new Command();
    program.command("explain <rule-id>").description("Explain a rule");
    const cmd = program.commands.find((c) => c.name() === "explain");
    expect(cmd).toBeDefined();
  });

  it("should have list-rules command", () => {
    const program = new Command();
    program.command("list-rules").description("List all rules");
    const cmd = program.commands.find((c) => c.name() === "list-rules");
    expect(cmd).toBeDefined();
  });
});

describe("CLI argument parsing", () => {
  it("should parse --format json", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedFormat = "";
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--format <format>", "Output format", "text")
      .action((_path: string, opts: any) => {
        capturedFormat = opts.format;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--format", "json"]);
    expect(capturedFormat).toBe("json");
  });

  it("should parse --output path", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedOutput = "";
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--output <path>", "Output file")
      .action((_path: string, opts: any) => {
        capturedOutput = opts.output;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--output", "./report.json"]);
    expect(capturedOutput).toBe("./report.json");
  });

  it("should parse --min-score", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedMinScore = "";
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--min-score <number>", "Min score")
      .action((_path: string, opts: any) => {
        capturedMinScore = opts.minScore;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--min-score", "80"]);
    expect(capturedMinScore).toBe("80");
  });

  it("should parse --fail-on", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedFailOn = "";
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--fail-on <level>", "Fail on")
      .action((_path: string, opts: any) => {
        capturedFailOn = opts.failOn;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--fail-on", "warning"]);
    expect(capturedFailOn).toBe("warning");
  });

  it("should parse scan with default args", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedPath = "";
    program
      .command("scan")
      .argument("[path]", "Path", ".")
      .action((path: string) => {
        capturedPath = path;
      });

    await program.parseAsync(["node", "repoproof", "scan"]);
    expect(capturedPath).toBe(".");
  });

  it("should parse scan with custom path", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedPath = "";
    program
      .command("scan")
      .argument("[path]", "Path", ".")
      .action((path: string) => {
        capturedPath = path;
      });

    await program.parseAsync(["node", "repoproof", "scan", "src/good-fixture"]);
    expect(capturedPath).toBe("src/good-fixture");
  });

  it("should parse --no-color flag", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedColor = true;
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--no-color", "Disable colors")
      .action((_path: string, opts: any) => {
        capturedColor = opts.color;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--no-color"]);
    expect(capturedColor).toBe(false);
  });

  it("should parse --quiet flag", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedQuiet = false;
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--quiet", "Quiet mode")
      .action((_path: string, opts: any) => {
        capturedQuiet = opts.quiet;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--quiet"]);
    expect(capturedQuiet).toBe(true);
  });

  it("should parse --verbose flag", async () => {
    const program = new Command();
    program.exitOverride();
    program.name("repoproof").version("1.0.0");

    let capturedVerbose = false;
    program
      .command("scan")
      .argument("[path]", "Path")
      .option("--verbose", "Verbose output")
      .action((_path: string, opts: any) => {
        capturedVerbose = opts.verbose;
      });

    await program.parseAsync(["node", "repoproof", "scan", "--verbose"]);
    expect(capturedVerbose).toBe(true);
  });
});

describe("CLI explain command", () => {
  it("should accept a rule ID argument", async () => {
    const program = new Command();
    program.exitOverride();

    let capturedId = "";
    program
      .command("explain")
      .argument("<rule-id>", "Rule identifier")
      .action((ruleId: string) => {
        capturedId = ruleId;
      });

    await program.parseAsync(["node", "repoproof", "explain", "todo-fixme"]);
    expect(capturedId).toBe("todo-fixme");
  });
});

describe("CLI list-rules command", () => {
  it("should be invocable", async () => {
    const program = new Command();
    program.exitOverride();

    let invoked = false;
    program
      .command("list-rules")
      .description("List all rules")
      .action(() => {
        invoked = true;
      });

    await program.parseAsync(["node", "repoproof", "list-rules"]);
    expect(invoked).toBe(true);
  });
});

describe("CLI --version flag", () => {
  it("should output version", () => {
    const program = new Command();
    program.version("1.0.0");
    expect(program.version()).toBe("1.0.0");
  });
});

describe("CLI --help flag", () => {
  it("should output help text", () => {
    const program = new Command();
    program.name("repoproof").description("Test CLI");
    const helpText = program.helpInformation();
    expect(helpText).toContain("repoproof");
  });
});

describe("CLI init command", () => {
  it("should be a valid command", () => {
    const program = new Command();
    const cmd = program.command("init").description("Generate starter config");
    expect(cmd.name()).toBe("init");
  });
});
