import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, normalizeApiBase } from "../src/api.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API client", () => {
  it("requires HTTPS except on a local development host", () => {
    expect(normalizeApiBase("https://analysis.example.org/")).toBe("https://analysis.example.org");
    expect(normalizeApiBase("http://localhost:8080")).toBe("http://localhost:8080");
    expect(normalizeApiBase("http://[::1]:8080")).toBe("http://[::1]:8080");
    expect(() => normalizeApiBase("http://analysis.example.org")).toThrow(ApiError);
    expect(() => normalizeApiBase("https://user@example.org")).toThrow(ApiError);
    expect(() => normalizeApiBase("https://analysis.example.org/api")).toThrow(ApiError);
    expect(() => normalizeApiBase("https://analysis.example.org?x=1")).toThrow(ApiError);
    expect(() => normalizeApiBase("https://analysis.example.org:bad")).toThrow(ApiError);
  });

  it("submits JSON without placing a job token in the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ job_id: "abc", access_token: "secret" }, 202));
    const client = createApiClient("https://analysis.example.org", fetchMock);
    const payload = { sequence: ">a\nACGT\n", mode: "detection" };

    await client.submit(payload);

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analysis.example.org/api/v1/jobs");
    expect(request.method).toBe("POST");
    expect(request.headers.Authorization).toBeUndefined();
    expect(JSON.parse(request.body)).toEqual(payload);
  });

  it("authenticates job polling with a Bearer header and never a URL token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "job-1", status: "queued" }));
    const client = createApiClient("https://analysis.example.org", fetchMock);

    await client.getJob("job/one", "private-token");

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analysis.example.org/api/v1/jobs/job%2Fone");
    expect(url).not.toContain("private-token");
    expect(request.headers.Authorization).toBe("Bearer private-token");
  });

  it("authenticates cancellation with the same credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "job-1", status: "cancelled" }));
    const client = createApiClient("https://analysis.example.org", fetchMock);

    await client.cancelJob("job-1", "private-token");

    const [, request] = fetchMock.mock.calls[0];
    expect(request.method).toBe("DELETE");
    expect(request.headers.Authorization).toBe("Bearer private-token");
  });

  it("downloads artifacts as authenticated blobs without token-bearing links", async () => {
    const blob = new Blob(["tree"], { type: "text/plain" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob));
    const client = createApiClient("https://analysis.example.org", fetchMock);

    const result = await client.downloadArtifact("job-1", "tree.nwk", "private-token");

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analysis.example.org/api/v1/jobs/job-1/artifacts/tree.nwk");
    expect(url).not.toContain("private-token");
    expect(request.headers.Authorization).toBe("Bearer private-token");
    expect(result).toBeInstanceOf(Blob);
  });
});
