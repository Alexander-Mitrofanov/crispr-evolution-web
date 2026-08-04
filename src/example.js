import { inspectFasta } from "./fasta.js";

export const EXAMPLE_FASTA_PATH = "example-input.fasta";
export const EXAMPLE_RESULT_PATH = "example-result.json";
export const EXAMPLE_SCHEMA_VERSION = "1.1.0";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const MASKED_RECORD_ID = /^example_record_\d{2}$/;
const FORBIDDEN_KEYS = new Set([
  "access_token",
  "artifact_url",
  "download_url",
  "job_id",
  "organism",
  "strain",
  "accession",
  "ncbi_url",
  "region_start_1based",
  "region_end_1based",
  "token",
  "token_digest",
]);
const DNA_ONLY = /^[ACGTRYSWKMBDHVN]+$/i;
const FORBIDDEN_IDENTITY = /(?:CP|FR)\d{6}/i;

function fail(message = "The example result is incomplete or incompatible with this interface.") {
  throw new Error(message);
}

function object(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function positiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function scanPublicSnapshot(value) {
  if (typeof value === "string") {
    if ((value.length >= 40 && DNA_ONLY.test(value)) || FORBIDDEN_IDENTITY.test(value)) fail();
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(scanPublicSnapshot);
    return;
  }
  if (!object(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail();
    scanPublicSnapshot(item);
  }
}

function validateRecord(record) {
  const allowedKeys = new Set([
    "record_id",
    "sequence_length",
    "source_array_orientation",
    "expected_spacer_count",
  ]);
  if (
    !object(record)
    || Object.keys(record).some((key) => !allowedKeys.has(key))
    || !MASKED_RECORD_ID.test(record.record_id)
    || !positiveInteger(record.sequence_length)
    || !["pos", "neg"].includes(record.source_array_orientation)
    || !positiveInteger(record.expected_spacer_count)
  ) fail();
}

function validateComparison(comparison) {
  if (!object(comparison)) fail();
  for (const key of [
    "confidence_threshold",
    "forward_ln_likelihood_bdm",
    "reverse_ln_likelihood_bdm",
    "forward_minus_reverse_ln_likelihood_bdm",
  ]) {
    if (!finite(comparison[key])) fail();
  }
  const delta = Number(comparison.forward_ln_likelihood_bdm) - Number(comparison.reverse_ln_likelihood_bdm);
  if (Math.abs(delta - Number(comparison.forward_minus_reverse_ln_likelihood_bdm)) > 1e-9) fail();
  const expected = delta > Number(comparison.confidence_threshold)
    ? "Forward"
    : delta < -Number(comparison.confidence_threshold)
      ? "Reverse"
      : "ND";
  if (comparison.prediction !== expected) fail();
}

function validateTeachingClaims(example, job) {
  const findings = example.findings;
  const summary = job.summary;
  const detection = summary.detection;
  const adapter = summary.adapter;
  const comparisons = summary.orientation.comparisons;
  const reconstructions = summary.orientation.selected_reconstructions;
  if (
    findings.detection.arrays !== detection.array_count
    || findings.detection.bona_fide !== detection.category_counts?.["Bona-fide"]
    || findings.detection.possible !== detection.category_counts?.Possible
    || findings.preflight.modeled_arrays !== adapter.emitted_array_count
    || findings.preflight.eligible_groups !== adapter.emitted_group_count
    || findings.preflight.excluded_arrays !== adapter.skipped_array_count
    || !Array.isArray(comparisons)
    || comparisons.length < 1
    || !Array.isArray(reconstructions)
    || reconstructions.length < 1
  ) fail();
  comparisons.forEach(validateComparison);
  const mainComparison = comparisons.find((item) => item.group === findings.orientation.group);
  const mainReconstruction = reconstructions.find((item) => item.name === findings.reconstruction.group);
  if (
    !mainComparison
    || !mainReconstruction
    || findings.orientation.delta_ln_likelihood !== mainComparison.forward_minus_reverse_ln_likelihood_bdm
    || findings.orientation.confidence_threshold !== mainComparison.confidence_threshold
    || findings.orientation.decision !== "Unresolved"
    || Math.abs(Number(findings.orientation.delta_ln_likelihood)) >= Number(findings.orientation.confidence_threshold)
    || findings.reconstruction.insertions !== mainReconstruction["nb of reconstructed insertions"]
    || findings.reconstruction.deletions !== mainReconstruction["nb of reconstructed deletions"]
    || findings.reconstruction.duplications !== mainReconstruction["nb of reconstructed duplications"]
  ) fail();
}

export function validateExampleSnapshot(value) {
  scanPublicSnapshot(value);
  const example = value?.example;
  const source = example?.source;
  const input = example?.input;
  const records = example?.records;
  const job = value?.job;
  const summary = job?.summary;
  if (
    value?.schema?.name !== "crispr-evolution-web-example"
    || value?.schema?.version !== EXAMPLE_SCHEMA_VERSION
    || !object(example)
    || typeof example.analysis_question !== "string"
    || typeof example.analysis_takeaway !== "string"
    || !object(source)
    || typeof source.masking_policy !== "string"
    || typeof source.provenance_note !== "string"
    || !object(input)
    || !Array.isArray(records)
    || records.length < 3
    || records.length !== input.record_count
    || !positiveInteger(input.base_count)
    || typeof input.filename !== "string"
    || !/\.fasta$/i.test(input.filename)
    || !SHA256_HEX.test(input.file_sha256)
    || !SHA256_HEX.test(input.normalized_sha256)
    || source.displayed_locus_bases !== input.base_count
    || job?.status !== "completed"
    || job?.mode !== "orientation"
    || !object(summary?.detection)
    || !object(summary?.adapter)
    || !object(summary?.orientation)
    || summary.pipeline_status !== "completed"
    || !Array.isArray(job.artifacts)
    || job.artifacts.length !== 0
    || job.options?.category_policy !== "bona_fide_possible"
    || job.options?.spacer_distance !== 1
    || job.options?.bias_corrections_requested !== true
    || job.options?.bias_corrections_effective !== true
  ) fail();
  records.forEach(validateRecord);
  if (
    new Set(records.map((record) => record.record_id)).size !== records.length
    || records.reduce((total, record) => total + record.sequence_length, 0) !== input.base_count
  ) fail();
  validateTeachingClaims(example, job);
  return value;
}

function normalizedFasta(inspection) {
  const lines = [];
  for (const record of inspection.records) {
    lines.push(`>${record.normalizedIdentifier}`);
    for (let offset = 0; offset < record.sequence.length; offset += 80) {
      lines.push(record.sequence.slice(offset, offset + 80));
    }
  }
  return `${lines.join("\n")}\n`;
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    fail("This browser cannot verify the stored example input.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateExampleInput(snapshotValue, sequence, { maxHeaderCharacters = 200 } = {}) {
  const snapshot = validateExampleSnapshot(snapshotValue);
  const inspection = inspectFasta(sequence, { maxHeaderCharacters });
  const expectedIds = snapshot.example.records.map((record) => record.record_id);
  const observedIds = inspection.records.map((record) => record.identifier);
  if (
    !inspection.valid
    || inspection.recordCount !== snapshot.example.input.record_count
    || inspection.baseCount !== snapshot.example.input.base_count
    || observedIds.length !== expectedIds.length
    || observedIds.some((identifier, index) => identifier !== expectedIds[index])
  ) fail("The stored example input does not match its precomputed result.");
  const [fileHash, normalizedHash] = await Promise.all([
    sha256Hex(sequence),
    sha256Hex(normalizedFasta(inspection)),
  ]);
  if (
    fileHash !== snapshot.example.input.file_sha256
    || normalizedHash !== snapshot.example.input.normalized_sha256
  ) fail("The stored example input does not match its precomputed result.");
  return { snapshot, inspection };
}
