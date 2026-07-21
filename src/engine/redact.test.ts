import { describe, it, expect } from "vitest";
import { redactSnippet } from "./redact.js";

describe("redact", () => {
  it("should return empty string for falsy input", () => {
    expect(redactSnippet("")).toBe("");
    expect(redactSnippet(undefined as unknown as string)).toBe(undefined);
  });

  it("should redact long quoted strings", () => {
    const result = redactSnippet('const x = "thisisalongstringvalue";');
    expect(result).toContain("[REDACTED]");
  });
});
