import { describe, it, expect } from "vitest";
import { greet } from "../index.js";

describe("greet", () => {
  it("should return a greeting", () => {
    expect(greet("World")).toBe("Hello, World!");
  });
});
