const DEFAULT_API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const PRIVATE_REQUEST_POLICY = Object.freeze({ cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });

export class ApiError extends Error {
  constructor(message, status = 0, code = "request_failed") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeApiBase(value) {
  const base = String(value || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new ApiError("The analysis API address is not a valid URL.", 0, "invalid_api_base");
  }
  // URL.hostname retains brackets around IPv6 literals in browsers and Node.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
    || parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
  ) {
    throw new ApiError("The analysis API must use HTTPS.", 0, "insecure_api_base");
  }
  return parsed.origin;
}

function createUrl(base, path) {
  const normalized = normalizeApiBase(base);
  if (!normalized) {
    throw new ApiError(
      "The site operator has not configured the analysis API.",
      0,
      "api_not_configured",
    );
  }
  return `${normalized}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseJsonResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A controlled status message is safer and clearer than a JSON parser detail.
  }
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === "string" ? detail : detail?.message;
    throw new ApiError(message || `The analysis service returned status ${response.status}.`, response.status, detail?.code);
  }
  return payload;
}

export function createApiClient(baseUrl = DEFAULT_API_BASE, fetchImpl = globalThis.fetch) {
  const endpoint = (path) => createUrl(baseUrl, path);
  const jobHeaders = (accessToken, extra = {}) => ({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  });

  return {
    configured: Boolean(String(baseUrl || "").trim()),
    displayBase: String(baseUrl || "").trim().replace(/\/+$/, ""),

    async health({ signal } = {}) {
      return parseJsonResponse(await fetchImpl(endpoint("/api/v1/health"), {
        ...PRIVATE_REQUEST_POLICY,
        headers: { Accept: "application/json" },
        signal,
      }));
    },

    async config({ signal } = {}) {
      return parseJsonResponse(await fetchImpl(endpoint("/api/v1/config"), {
        ...PRIVATE_REQUEST_POLICY,
        headers: { Accept: "application/json" },
        signal,
      }));
    },

    async submit(payload, { signal } = {}) {
      return parseJsonResponse(await fetchImpl(endpoint("/api/v1/jobs"), {
        ...PRIVATE_REQUEST_POLICY,
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }));
    },

    async getJob(jobId, accessToken, { signal } = {}) {
      return parseJsonResponse(await fetchImpl(endpoint(`/api/v1/jobs/${encodeURIComponent(jobId)}`), {
        ...PRIVATE_REQUEST_POLICY,
        headers: jobHeaders(accessToken),
        signal,
      }));
    },

    async cancelJob(jobId, accessToken, { signal } = {}) {
      return parseJsonResponse(await fetchImpl(endpoint(`/api/v1/jobs/${encodeURIComponent(jobId)}`), {
        ...PRIVATE_REQUEST_POLICY,
        method: "DELETE",
        headers: jobHeaders(accessToken),
        signal,
      }));
    },

    async downloadBundle(jobId, accessToken, { signal } = {}) {
      const response = await fetchImpl(endpoint(`/api/v1/jobs/${encodeURIComponent(jobId)}/result`), {
        ...PRIVATE_REQUEST_POLICY,
        headers: jobHeaders(accessToken, { Accept: "application/zip, application/octet-stream" }),
        signal,
      });
      if (!response.ok) return parseJsonResponse(response);
      return response.blob();
    },

    async downloadArtifact(jobId, artifactId, accessToken, { signal } = {}) {
      const response = await fetchImpl(
        endpoint(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`),
        {
          ...PRIVATE_REQUEST_POLICY,
          headers: jobHeaders(accessToken, { Accept: "application/octet-stream" }),
          signal,
        },
      );
      if (!response.ok) return parseJsonResponse(response);
      return response.blob();
    },
  };
}

export const api = createApiClient();
