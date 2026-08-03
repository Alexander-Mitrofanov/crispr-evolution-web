const RECOVERY_SCHEMA = "crispr-evolution-job-recovery-v1";
const JOB_ID_PATTERN = /^[0-9a-f]{32}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function normalizeJobCredential(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Recovery credential must be a JSON object.");
  }
  const expectedKeys = ["accessToken", "expiresAt", "jobId"];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Recovery credential must contain exactly the supported fields.");
  }
  const { jobId, accessToken, expiresAt } = value;
  if (typeof jobId !== "string" || typeof accessToken !== "string") {
    throw new Error("Recovery credential has an invalid job ID or access token.");
  }
  if (!JOB_ID_PATTERN.test(jobId) || !TOKEN_PATTERN.test(accessToken)) {
    throw new Error("Recovery credential has an invalid job ID or access token.");
  }
  if (expiresAt != null) {
    const expiry = Date.parse(String(expiresAt));
    if (!Number.isFinite(expiry)) throw new Error("Recovery credential has an invalid expiry.");
    if (expiry <= now) throw new Error("Recovery credential has expired.");
  }
  return { jobId, accessToken, expiresAt: expiresAt == null ? null : String(expiresAt) };
}

export function serializeJobCredential(value) {
  const credential = normalizeJobCredential(value, 0);
  return JSON.stringify({
    schema: RECOVERY_SCHEMA,
    job_id: credential.jobId,
    access_token: credential.accessToken,
    expires_at: credential.expiresAt,
  }, null, 2) + "\n";
}

export function parseJobCredential(text, now = Date.now()) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > 16_384) {
    throw new Error("Recovery file must be a small JSON document.");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Recovery file is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Recovery credential must be a JSON object.");
  }
  const expectedKeys = ["access_token", "expires_at", "job_id", "schema"];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Recovery file must contain exactly the supported fields.");
  }
  if (value.schema !== RECOVERY_SCHEMA) {
    throw new Error("Recovery file schema is not supported.");
  }
  if (typeof value.job_id !== "string" || typeof value.access_token !== "string" || (value.expires_at !== null && typeof value.expires_at !== "string")) {
    throw new Error("Recovery file fields have invalid types.");
  }
  return normalizeJobCredential({
    jobId: value.job_id,
    accessToken: value.access_token,
    expiresAt: value.expires_at,
  }, now);
}
