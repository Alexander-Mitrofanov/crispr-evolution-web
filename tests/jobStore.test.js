import { describe, expect, it } from "vitest";

import { normalizeJobCredential, parseJobCredential, serializeJobCredential } from "../src/jobStore.js";

const credential = {
  jobId: "0123456789abcdef0123456789abcdef",
  accessToken: "a".repeat(43),
  expiresAt: "2099-01-01T00:00:00Z",
};

describe("job recovery credentials", () => {
  it("round-trips a versioned JSON recovery file without browser storage", () => {
    expect(parseJobCredential(serializeJobCredential(credential), 0)).toEqual(credential);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("keeps queued credentials valid before terminal retention is known", () => {
    expect(normalizeJobCredential({ ...credential, expiresAt: null })).toEqual({ ...credential, expiresAt: null });
  });

  it("rejects expired, oversized, malformed, and wrong-schema recovery data", () => {
    expect(() => parseJobCredential(serializeJobCredential({ ...credential, expiresAt: "2020-01-01T00:00:00Z" }), Date.parse("2021-01-01"))).toThrow(/expired/i);
    expect(() => parseJobCredential("x".repeat(16_385))).toThrow(/small JSON/i);
    expect(() => parseJobCredential("not json")).toThrow(/valid JSON/i);
    const wrongSchema = JSON.parse(serializeJobCredential(credential));
    wrongSchema.schema = "other";
    expect(() => parseJobCredential(JSON.stringify(wrongSchema))).toThrow(/schema/i);
    expect(() => parseJobCredential(JSON.stringify({ ...JSON.parse(serializeJobCredential(credential)), extra: true }))).toThrow(/exactly/i);
    expect(() => normalizeJobCredential({ ...credential, accessToken: "short" })).toThrow(/invalid job ID or access token/i);
    expect(() => normalizeJobCredential({ ...credential, unexpected: true })).toThrow(/exactly/i);
  });
});
