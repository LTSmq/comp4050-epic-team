import { describe, expect, it } from "vitest";
import { apiKeyMatches } from "./apiKey";

describe("apiKeyMatches", () => {
  it("accepts the exact key", () => {
    expect(apiKeyMatches("secret-key", "secret-key")).toBe(true);
  });

  it("rejects a different key", () => {
    expect(apiKeyMatches("secret-kez", "secret-key")).toBe(false);
  });

  it("rejects keys of a different length without throwing", () => {
    expect(apiKeyMatches("short", "a-much-longer-expected-key")).toBe(false);
  });

  it("rejects a missing key", () => {
    expect(apiKeyMatches(null, "secret-key")).toBe(false);
    expect(apiKeyMatches("", "secret-key")).toBe(false);
  });

  it("rejects everything when no key is configured", () => {
    expect(apiKeyMatches("secret-key", undefined)).toBe(false);
    expect(apiKeyMatches("", "")).toBe(false);
  });
});
