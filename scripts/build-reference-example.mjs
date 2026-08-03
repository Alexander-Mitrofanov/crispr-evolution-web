#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExampleSnapshot } from "../src/example.js";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null) {
      throw new Error("usage: build-reference-example --manifest PATH --job PATH --health PATH --output PATH");
    }
    options[key.slice(2)] = value;
  }
  for (const key of ["manifest", "job", "health", "output"]) {
    if (!options[key]) throw new Error(`missing --${key}`);
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite`);
  return number;
}

function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`);
  return number;
}

function accessionFromRecordId(sourceId) {
  return String(sourceId || "").replace(/^\d+_/, "").replace(/_publication_CRISPR_locus$/, "");
}

function makeGroupMap(summary) {
  const names = [];
  const add = (value) => {
    const name = String(value || "").trim();
    if (name && !names.includes(name)) names.push(name);
  };
  for (const group of summary.adapter?.groups || []) add(group.name);
  for (const group of summary.orientation?.comparisons || []) add(group.group);
  for (const row of summary.orientation?.selected_reconstructions || []) add(row.name);
  return new Map(names.map((name, index) => [name, `cohort_${String(index + 1).padStart(3, "0")}`]));
}

function groupName(value, groupMap) {
  const mapped = groupMap.get(String(value || ""));
  if (!mapped) throw new Error(`unmapped comparison group: ${value}`);
  return mapped;
}

function summarizeArtifacts(artifacts) {
  const counts = new Map();
  for (const artifact of artifacts) {
    const name = String(artifact.name || "");
    const size = integer(artifact.size_bytes, `artifact size for ${name}`);
    if (size <= 0) throw new Error(`registered artifact is empty: ${name}`);
    let label = "Other nonempty outputs";
    if (name.startsWith("crispridentify/") && name.endsWith("report.json")) label = "CRISPRidentify per-record JSON reports";
    else if (name.startsWith("crispridentify/") && name.endsWith("Summary.csv")) label = "CRISPRidentify per-record summary tables";
    else if (name === "crispridentify/Complete_summary.csv") label = "CRISPRidentify cohort summary table";
    else if (name === "adapter/manifest.json") label = "Sanitized integration adapter manifest";
    else if (name === "crispr_evor/0_results.csv") label = "CRISPR-evOr likelihood table";
    else if (name === "crispr_evor/crispr_evor_results.json") label = "CRISPR-evOr structured result";
    else if (name === "crispr_evor/additional_data/orientation_trees.json") label = "Accession-derived orientation tree payload";
    else if (name === "provenance.json") label = "Run provenance manifest";
    else if (name === "results.zip") label = "Private authenticated result bundle";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count, status: "nonempty" }));
}

function buildSnapshot({ manifest, job, health }) {
  if (job.status !== "completed") throw new Error("production job did not complete");
  const summary = job.summary || {};
  const detection = summary.detection || {};
  const adapter = summary.adapter || {};
  const orientation = summary.orientation || {};
  const references = manifest.records.map((record) => {
    const start = integer(record.region_start_1based, "reference start");
    const end = integer(record.region_end_1based, "reference end");
    const span = integer(record.sequence_length, "reference span");
    if (end - start + 1 !== span) throw new Error(`span mismatch for ${record.accession}`);
    return {
      accession: record.accession,
      region_start_1based: start,
      region_end_1based: end,
      analyzed_span_bases: span,
      publication_array_orientation: record.publication_strand,
      published_spacer_count: integer(record.publication_spacer_count, "published spacer count"),
      ncbi_url: record.ncbi_url,
    };
  });
  const referenceAccessions = new Set(references.map((record) => record.accession.split(".")[0]));
  const groupMap = makeGroupMap(summary);
  const arrays = (detection.arrays || []).map((array, index) => {
    const accession = accessionFromRecordId(array.source_id);
    if (!referenceAccessions.has(accession)) throw new Error(`detected array has unknown source: ${array.source_id}`);
    return {
      array_id: `array_${String(index + 1).padStart(3, "0")}`,
      source_id: references.find((record) => record.accession.startsWith(`${accession}.`))?.accession || accession,
      start: integer(array.start, "array start"),
      end: integer(array.end, "array end"),
      category: array.category,
      strand: array.strand || "Unknown",
      spacer_count: integer(array.spacer_count, "array spacer count"),
      repeat_count: integer(array.repeat_count, "array repeat count"),
      model_score: finiteNumber(array.model_score, "CRISPRidentify model score"),
      model_score_is_probability: array.model_score_is_probability === true,
      selected_for_analysis: array.selected_for_analysis === true,
    };
  });
  const spacerCounts = arrays.map((array) => array.spacer_count);
  const scores = arrays.map((array) => array.model_score);
  const strandCounts = arrays.reduce((counts, array) => ({ ...counts, [array.strand]: (counts[array.strand] || 0) + 1 }), {});
  const comparisons = (orientation.comparisons || []).map((comparison) => {
    const forward = finiteNumber(comparison.forward_ln_likelihood_bdm, "forward likelihood");
    const reverse = finiteNumber(comparison.reverse_ln_likelihood_bdm, "reverse likelihood");
    const delta = finiteNumber(comparison.forward_minus_reverse_ln_likelihood_bdm, "delta likelihood");
    if (Math.abs(delta - (forward - reverse)) > 1e-9) throw new Error("orientation delta mismatch");
    const threshold = finiteNumber(comparison.confidence_threshold, "confidence threshold");
    const decision = delta > threshold ? "Forward" : delta < -threshold ? "Reverse" : "Unresolved";
    return {
      group: groupName(comparison.group, groupMap),
      prediction: comparison.prediction === "ND" ? "Unresolved" : comparison.prediction,
      recommended_reverse: comparison.recommended_reverse,
      decisive: comparison.decisive === true,
      confidence_threshold: threshold,
      forward_ln_likelihood_bdm: forward,
      reverse_ln_likelihood_bdm: reverse,
      forward_minus_reverse_ln_likelihood_bdm: delta,
      decision,
    };
  });
  const reconstructions = (orientation.selected_reconstructions || []).map((row) => ({
    name: groupName(row.name, groupMap),
    "Deletion model preferred by LRT": row["Deletion model preferred by LRT"],
    ln_lh_bdm: finiteNumber(row.ln_lh_bdm, "BDM likelihood"),
    reversed_ln_lh_bdm: finiteNumber(row.reversed_ln_lh_bdm, "reverse BDM likelihood"),
    "ln_lh_bdm - reversed_ln_lh_bdm": finiteNumber(row["ln_lh_bdm - reversed_ln_lh_bdm"], "reconstruction delta"),
    "nb of reconstructed insertions": integer(row["nb of reconstructed insertions"], "insertions"),
    "nb of reconstructed deletions": integer(row["nb of reconstructed deletions"], "deletions"),
    "nb of reconstructed duplications": integer(row["nb of reconstructed duplications"], "duplications"),
    "nb of reconstructed rearrangements": integer(row["nb of reconstructed rearrangements"], "rearrangements"),
    "nb of unique spacers": integer(row["nb of unique spacers"], "unique spacers"),
    "nb of spacers in model matrix": integer(row["nb of spacers in alignment"], "model-matrix spacers"),
    "nb of leafs (after combining non-uniques)": integer(row["nb of leafs (after combining non-uniques)"], "leaf count"),
    deletion_rate_bdm: finiteNumber(row.deletion_rate_bdm, "deletion rate"),
    insertion_rate_bdm: finiteNumber(row.insertion_rate_bdm, "insertion rate"),
    run_time: finiteNumber(row.run_time, "runtime"),
    "predicted orientation": row["predicted orientation"] === "ND" ? "Unresolved" : row["predicted orientation"],
    "recommend reversing array": row["recommend reversing array"],
  }));
  const totals = reconstructions.reduce((sum, row) => ({
    insertions: sum.insertions + row["nb of reconstructed insertions"],
    deletions: sum.deletions + row["nb of reconstructed deletions"],
    duplications: sum.duplications + row["nb of reconstructed duplications"],
    rearrangements: sum.rearrangements + row["nb of reconstructed rearrangements"],
  }), { insertions: 0, deletions: 0, duplications: 0, rearrangements: 0 });
  const decisiveCount = comparisons.filter((comparison) => comparison.decisive).length;
  const strongest = [...comparisons].sort((left, right) => Math.abs(right.forward_minus_reverse_ln_likelihood_bdm) - Math.abs(left.forward_minus_reverse_ln_likelihood_bdm))[0];
  const analyzedSpan = references.reduce((sum, record) => sum + record.analyzed_span_bases, 0);
  const sourceTotal = integer(manifest.source_genome_total_bases, "source total");
  const directBaseline = 60.51528792782125;
  const generatedAt = new Date().toISOString();
  const releaseTools = Object.fromEntries(Object.entries(health.scientific_artifacts || {}).map(([key, value]) => [key, {
    display_name: value.display_name,
    version: value.version,
    kind: value.kind,
    sha256: value.sha256,
    sha256_scope: value.sha256_scope,
  }]));
  const warningItems = (summary.warnings || []).map((warning, index) => ({
    code: `operational_notice_${String(index + 1).padStart(2, "0")}`,
    stage: "packaging",
    message: String(warning)
      .replace(/repeat_[0-9a-f]+/g, "cohort_hidden")
      .replace(/[ACGTRYSWKMBDHVN]{20,}/gi, "[iupac-string-hidden]"),
  }));
  const snapshot = {
    schema: { name: "crispr-evolution-web-example", version: "2.0.0" },
    example: {
      id: "klebsiella-g768-reference-v1",
      kind: "Publication cohort · genome references only",
      title: "Klebsiella pneumoniae I-E CRISPR orientation cohort",
      organism: "Klebsiella pneumoniae",
      description: "Twelve accession-referenced CRISPR locus windows from the CRISPR-evOr publication bundle exercise detection, cohort integration, ancestral reconstruction, and orientation likelihood comparison without hosting nucleotide sequence.",
      biological_question: "Across related Klebsiella pneumoniae I-E arrays, which spacer-array order is better supported by the gain/loss model after CRISPRidentify detects loci directly from genomic context?",
      biological_takeaway: "The workflow separates detection from evolutionary interpretation: every referenced locus is detected, seven arrays form two comparable cohorts, SpacerPlacer reconstructs explicit gain/loss histories, and CRISPR-evOr shows one decisive forward cohort plus one unresolved cohort rather than forcing a single overconfident answer.",
      publication_baseline_note: `The direct publication-bundle baseline selected this cohort because the supplied spacer arrays had forward-minus-reverse BDM support of +${directBaseline.toFixed(6)}. The web example re-detects arrays from genomic windows, so its fresh grouped results are related but not expected to be numerically identical.`,
    },
    sources: {
      publication_url: "https://doi.org/10.1371/journal.pcbi.1013706",
      frozen_workflow_url: "CRISPR-evOr/example_datasets/orientation_paper_examples/g_768_klebsiella_pneumoniae_I-E",
      frozen_source_commit: "local-publication-bundle-2026-08-03",
      repository: "local CRISPR-evOr publication example bundle",
      retrieval_date: "2026-08-03",
      extraction_policy: "Exact accession records; complete published spacer-chain span plus up to 250 bases of flanking genomic context on each available side; genome references only are published.",
      analyzed_span_bases: analyzedSpan,
      source_genome_total_bases: sourceTotal,
      analyzed_fraction_percent: (analyzedSpan / sourceTotal) * 100,
      flank_bases_each_side: integer(manifest.flank_bases_each_side, "flank size"),
    },
    references,
    findings: {
      detection: {
        source_count: integer(detection.source_count, "source count"),
        array_count: integer(detection.array_count, "array count"),
        selected_array_count: integer(detection.selected_array_count, "selected array count"),
        unselected_array_count: integer(detection.unselected_array_count, "unselected array count"),
        report_count: integer(detection.report_count, "report count"),
        category_counts: detection.category_counts,
        selected_category_counts: detection.selected_category_counts,
        strand_counts: strandCounts,
        spacer_count_range: [Math.min(...spacerCounts), Math.max(...spacerCounts)],
        model_score_range: [Math.min(...scores), Math.max(...scores)],
        arrays,
      },
      preflight: {
        input_array_count: integer(adapter.input_array_count, "adapter input arrays"),
        selected_array_count: integer(adapter.selected_array_count, "adapter selected arrays"),
        modeled_arrays: integer(adapter.emitted_array_count, "modeled arrays"),
        eligible_groups: integer(adapter.emitted_group_count, "eligible groups"),
        excluded_arrays: integer(adapter.skipped_array_count, "excluded arrays"),
        unknown_strand_excluded_count: integer(adapter.unknown_strand_excluded_count, "unknown strand exclusions"),
        skipped_by_reason: adapter.skipped_by_reason || {},
        groups: (adapter.groups || []).map((group) => ({
          name: groupName(group.name, groupMap),
          array_count: integer(group.array_count, "group array count"),
        })),
      },
      reconstruction: {
        selected_reconstruction_count: reconstructions.length,
        tree_policy: orientation.tree_policy,
        totals,
        groups: reconstructions,
      },
      orientation: {
        status: orientation.status,
        tree_policy: orientation.tree_policy,
        comparison_count: comparisons.length,
        decisive_count: decisiveCount,
        unresolved_count: comparisons.length - decisiveCount,
        strongest_group: strongest?.group || null,
        strongest_delta_ln_likelihood: strongest?.forward_minus_reverse_ln_likelihood_bdm || null,
        confidence_threshold: strongest?.confidence_threshold || 5,
        decision: strongest?.decision || "Unresolved",
        comparisons,
      },
      deliverables: {
        registered_artifact_count: (job.artifacts || []).length,
        zero_registered_artifact_count: (job.artifacts || []).filter((artifact) => Number(artifact.size_bytes) === 0).length,
        logical_outputs: summarizeArtifacts(job.artifacts || []),
      },
      warnings: warningItems,
    },
    release: {
      backend_version: health.version,
      backend_release_id: health.release_id,
      backend_wheel_sha256: health.backend_wheel_sha256,
      scientific_release_manifest_sha256: health.scientific_release_manifest_sha256,
      scientific_artifacts: releaseTools,
    },
    result: {
      status: "completed",
      mode: "orientation",
      summary: {
        schema_version: "2.0.0-reference-projection",
        pipeline_status: summary.pipeline_status,
        detection: {
          source_count: detection.source_count,
          array_count: detection.array_count,
          selected_array_count: detection.selected_array_count,
          unselected_array_count: detection.unselected_array_count,
          category_counts: detection.category_counts,
          selected_category_counts: detection.selected_category_counts,
          score_semantics: detection.score_semantics,
          arrays,
          arrays_truncated: false,
        },
        adapter: {
          input_array_count: adapter.input_array_count,
          selected_array_count: adapter.selected_array_count,
          emitted_array_count: adapter.emitted_array_count,
          emitted_group_count: adapter.emitted_group_count,
          skipped_array_count: adapter.skipped_array_count,
          unknown_strand_excluded_count: adapter.unknown_strand_excluded_count,
          skipped_by_reason: adapter.skipped_by_reason || {},
          groups: (adapter.groups || []).map((group) => ({
            name: groupName(group.name, groupMap),
            array_count: integer(group.array_count, "group array count"),
          })),
        },
        orientation: {
          status: orientation.status,
          tree_policy: orientation.tree_policy,
          comparisons,
          comparisons_truncated: false,
          selected_reconstructions: reconstructions,
          selected_reconstructions_truncated: false,
        },
        reconstruction: null,
        warnings: [],
        provenance: {
          versions: Object.fromEntries(Object.values(releaseTools).map((tool) => [tool.display_name, tool.version])),
          parameters: {
            mode: "orientation",
            category_policy: "bona_fide_possible",
            spacer_edit_distance: 1,
            bias_corrections: "enabled",
            tree_policy: orientation.tree_policy,
          },
        },
      },
    },
    snapshot: {
      generated_at: generatedAt,
      run_prefix: String(job.job_id || "").slice(0, 8),
      production_run_started_at: job.started_at,
      production_run_finished_at: job.finished_at,
      operational_warnings_omitted_from_results_panel: warningItems.length,
      public_data_policy: "Genome references only; no nucleotide bases, repeats, spacers, alignments, sequence-file hashes, complete run payloads, credentials, or artifact URLs are hosted.",
      sanitizer: "frontend/scripts/build-reference-example.mjs",
    },
  };
  return validateExampleSnapshot(snapshot);
}

const options = parseArgs(process.argv.slice(2));
const snapshot = buildSnapshot({
  manifest: readJson(options.manifest),
  job: readJson(options.job),
  health: readJson(options.health),
});
writeFileSync(options.output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: options.output, references: snapshot.references.length, artifacts: snapshot.findings.deliverables.registered_artifact_count }));
