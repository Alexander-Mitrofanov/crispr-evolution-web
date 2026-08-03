import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import snapshot from "../public/example-klebsiella-g768-reference-v1.json";
import { EXAMPLE_RESULT_PATH, validateExampleSnapshot } from "../src/example.js";

const DNA_ONLY = /^[ACGTRYSWKMBDHVN]+$/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectInvalid(mutator) {
  const copy = clone(snapshot);
  mutator(copy);
  expect(() => validateExampleSnapshot(copy)).toThrow(/incomplete or incompatible/i);
}

function scalars(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => scalars(item, output));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
    output.push(key);
    scalars(item, output);
  });
  return output;
}

describe("Klebsiella reference-only example data contract", () => {
  it("validates the public snapshot and publishes no sequence file", () => {
    expect(validateExampleSnapshot(snapshot)).toBe(snapshot);
    expect(EXAMPLE_RESULT_PATH).toBe("example-klebsiella-g768-reference-v1.json");
    expect(snapshot).not.toHaveProperty("job");
    expect(snapshot).toHaveProperty("result");

    const publicRoot = resolve(process.cwd(), "public");
    const publicFiles = readdirSync(publicRoot);
    expect(publicFiles.some((name) => /\.(fa|fasta|fna|ffn|fas)$/i.test(name))).toBe(false);
    expect(existsSync(resolve(publicRoot, "example-related-isolates.fasta"))).toBe(false);
    expect(existsSync(resolve(publicRoot, "example-listeria-monocytogenes-result.json"))).toBe(false);
  });

  it("keeps all 12 publication references coordinate-only and internally consistent", () => {
    expect(snapshot.references).toHaveLength(12);
    expect(new Set(snapshot.references.map((record) => record.accession)).size).toBe(12);
    expect(new Set(snapshot.references.map((record) => record.ncbi_url)).size).toBe(12);
    expect(snapshot.sources.analyzed_span_bases).toBe(15_128);
    expect(snapshot.sources.source_genome_total_bases).toBe(65_247_466);
    expect(snapshot.references.reduce((sum, record) => sum + record.analyzed_span_bases, 0)).toBe(15_128);
    expect(snapshot.references.filter((record) => record.publication_array_orientation === "+")).toHaveLength(9);
    expect(snapshot.references.filter((record) => record.publication_array_orientation === "-")).toHaveLength(3);
    expect(Math.min(...snapshot.references.map((record) => record.published_spacer_count))).toBe(4);
    expect(Math.max(...snapshot.references.map((record) => record.published_spacer_count))).toBe(27);
  });

  it("derives teaching claims from sanitized result fields", () => {
    const { findings, result } = snapshot;
    expect(findings.detection.array_count).toBe(result.summary.detection.array_count);
    expect(findings.detection.category_counts).toEqual(result.summary.detection.category_counts);
    expect(findings.preflight.modeled_arrays).toBe(result.summary.adapter.emitted_array_count);
    expect(findings.preflight.eligible_groups).toBe(result.summary.adapter.emitted_group_count);
    expect(findings.reconstruction.groups).toEqual(result.summary.orientation.selected_reconstructions);
    expect(findings.orientation.comparisons).toEqual(result.summary.orientation.comparisons);
    expect(findings.orientation.decisive_count).toBe(1);
    expect(findings.orientation.unresolved_count).toBe(1);
    expect(findings.deliverables.registered_artifact_count).toBe(39);
    expect(findings.deliverables.zero_registered_artifact_count).toBe(0);
  });

  it("contains no long IUPAC-only strings, repeat-derived IDs, raw jobs, or forbidden file names", () => {
    const values = scalars(snapshot);
    expect(values.filter((value) => value.length >= 20 && DNA_ONLY.test(value))).toEqual([]);
    expect(values.join("\n")).not.toMatch(/repeat_[0-9a-f]{8,}/i);
    expect(values.join("\n")).not.toMatch(/example-related-isolates|example-listeria|\.fasta|\.fna|repeat_key|raw job|access_token/i);
  });

  it("rejects malformed or unsafe snapshots", () => {
    expectInvalid((copy) => { copy.job = {}; });
    expectInvalid((copy) => { copy.findings.preflight.groups[0].repeat_key = "repeat_c1e96bde1fe2"; });
    expectInvalid((copy) => { copy.references[0].region_end_1based = copy.references[0].region_start_1based - 1; });
    expectInvalid((copy) => { copy.references[1].accession = copy.references[0].accession; });
    expectInvalid((copy) => { copy.findings.detection.arrays[0].model_score = "not-a-number"; });
    expectInvalid((copy) => { copy.findings.orientation.comparisons[0].forward_minus_reverse_ln_likelihood_bdm += 1; });
    expectInvalid((copy) => { copy.findings.deliverables.zero_registered_artifact_count = 1; });
    expectInvalid((copy) => { copy.findings.deliverables.logical_outputs[0].count = 0; });
    expectInvalid((copy) => { copy.example.description = "ACGTRYSWKMBDHVNACGTRYSWKMBDHVN"; });
  });
});
