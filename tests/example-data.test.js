import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import snapshot from "../public/example-result.json";
import {
  EXAMPLE_FASTA_PATH,
  EXAMPLE_RESULT_PATH,
  validateExampleInput,
  validateExampleSnapshot,
} from "../src/example.js";
import { inspectFasta } from "../src/fasta.js";

const publicRoot = resolve(process.cwd(), "public");
const fasta = readFileSync(resolve(publicRoot, EXAMPLE_FASTA_PATH), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("masked stored-input/precomputed-output contract", () => {
  it("binds the public FASTA to the precomputed snapshot by raw and normalized SHA-256", async () => {
    expect(validateExampleSnapshot(snapshot)).toBe(snapshot);
    await expect(validateExampleInput(snapshot, fasta)).resolves.toMatchObject({ snapshot });
    const inspection = inspectFasta(fasta);
    expect(inspection).toMatchObject({ valid: true, recordCount: 11, baseCount: 9_598 });
    expect(createHash("sha256").update(fasta).digest("hex")).toBe(snapshot.example.input.file_sha256);
    expect(snapshot.example.input.normalized_sha256).toBe("45a36a7b7d326b02a5c7361ccb66ded6f5ef568423fb77967a8857d65d820c95");
    expect(EXAMPLE_RESULT_PATH).toBe("example-result.json");
    expect(existsSync(resolve(publicRoot, EXAMPLE_RESULT_PATH))).toBe(true);
    expect(existsSync(resolve(publicRoot, "obsolete-example-result.json"))).toBe(false);
  });

  it("keeps every teaching claim equal to the completed job summary", () => {
    const { findings } = snapshot.example;
    const { detection, adapter, orientation } = snapshot.job.summary;
    const mainReconstruction = orientation.selected_reconstructions.find((row) => row.name === findings.reconstruction.group);
    const mainComparison = orientation.comparisons.find((row) => row.group === findings.orientation.group);
    expect(findings.detection.arrays).toBe(detection.array_count);
    expect(findings.detection.bona_fide).toBe(detection.category_counts["Bona-fide"]);
    expect(findings.detection.possible).toBe(detection.category_counts.Possible);
    expect(findings.preflight.modeled_arrays).toBe(adapter.emitted_array_count);
    expect(findings.preflight.eligible_groups).toBe(adapter.emitted_group_count);
    expect(findings.preflight.excluded_arrays).toBe(adapter.skipped_array_count);
    expect(findings.reconstruction.insertions).toBe(mainReconstruction["nb of reconstructed insertions"]);
    expect(findings.reconstruction.deletions).toBe(mainReconstruction["nb of reconstructed deletions"]);
    expect(findings.reconstruction.duplications).toBe(mainReconstruction["nb of reconstructed duplications"]);
    expect(findings.orientation.delta_ln_likelihood).toBe(mainComparison.forward_minus_reverse_ln_likelihood_bdm);
    expect(Math.abs(findings.orientation.delta_ln_likelihood)).toBeLessThan(findings.orientation.confidence_threshold);
    expect(findings.orientation.decision).toBe("Unresolved");
  });

  it("publishes only ordered masked record identifiers", () => {
    const inspection = inspectFasta(fasta);
    const expectedIds = ["example_record_01", "example_record_02", "example_record_03", "example_record_04", "example_record_05", "example_record_06", "example_record_07", "example_record_08", "example_record_09", "example_record_10", "example_record_11"];
    expect(inspection.records.map((record) => record.identifier)).toEqual(expectedIds);
    expect(snapshot.example.records.map((record) => record.record_id)).toEqual(expectedIds);
    expect(snapshot.job.summary.detection.arrays.map((record) => record.source_id)).toEqual(expectedIds);
    expect(snapshot.example.records.every((record) => Object.keys(record).every((key) => ["record_id", "sequence_length", "source_array_orientation", "expected_spacer_count"].includes(key)))).toBe(true);
    expect(snapshot.example.records.reduce((sum, record) => sum + record.sequence_length, 0)).toBe(inspection.baseCount);
    expect(JSON.stringify(snapshot)).not.toMatch(/(?:CP|FR)\d{6}|ncbi\.nlm\.nih\.gov/i);
  });

  it("fails closed for byte changes, normalized changes, credentials, and inconsistent claims", async () => {
    await expect(validateExampleInput(snapshot, `${fasta}\n`)).rejects.toThrow(/does not match/i);
    const wrongHash = clone(snapshot);
    wrongHash.example.input.normalized_sha256 = "0".repeat(64);
    await expect(validateExampleInput(wrongHash, fasta)).rejects.toThrow(/does not match/i);
    const credentialLeak = clone(snapshot);
    credentialLeak.access_token = "not-public";
    expect(() => validateExampleSnapshot(credentialLeak)).toThrow(/incomplete or incompatible/i);
    const identityLeak = clone(snapshot);
    identityLeak.example.records[0].accession = "source-record";
    expect(() => validateExampleSnapshot(identityLeak)).toThrow(/incomplete or incompatible/i);
    const changedClaim = clone(snapshot);
    changedClaim.example.findings.reconstruction.insertions += 1;
    expect(() => validateExampleSnapshot(changedClaim)).toThrow(/incomplete or incompatible/i);
  });
});
