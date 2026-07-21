import { describe, it, expect } from "vitest";
import { findConfig, loadConfig } from "./config-loader.js";

describe("config-loader", () => {
  it("should find config from a directory", () => {
    const result = findConfig(process.cwd());
    expect(result).toBeTruthy();
  });

  it("should load a valid config file", () => {
    const config = loadConfig();
    expect(config).toBeDefined();
  });
});
