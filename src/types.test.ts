import { describe, it, expect } from "vitest";
import type { RepoProofConfig } from "./types.js";

describe("types", () => {
  it("should define RepoProofConfig type correctly", () => {
    const config: RepoProofConfig = {
      minScore: 90,
      failOn: "error",
    };
    expect(config.minScore).toBe(90);
    expect(config.failOn).toBe("error");
  });
});
