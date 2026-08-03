export const EXAMPLE_RESULT_PATH = "example-klebsiella-g768-reference-v1.json";
export const EXAMPLE_SCHEMA_VERSION = "2.0.0";

const REFERENCE_COUNT = 12;
const ANALYZED_SPAN_BASES = 15_128;
const SOURCE_GENOME_TOTAL_BASES = 65_247_466;
const DNA_ONLY = /^[ACGTRYSWKMBDHVN]+$/i;
const SEQUENCE_EXTENSION = /\.(?:fa|fasta|fna|ffn|fas)(?:$|[?#])/i;
const FORBIDDEN_KEY = /(^|_)(?:sequence|repeat_key|spacer_sequence|consensus|alignment|fasta|token|request|raw|raw_job|artifact_url|job)(?:_|$)/i;

const ROOT_KEYS = ["schema", "example", "sources", "references", "findings", "release", "result", "snapshot"];
const SHAPES = {
  schema: ["name", "version"],
  example: ["id", "kind", "title", "organism", "description", "biological_question", "biological_takeaway", "publication_baseline_note"],
  sources: ["publication_url", "frozen_workflow_url", "frozen_source_commit", "repository", "retrieval_date", "extraction_policy", "analyzed_span_bases", "source_genome_total_bases", "analyzed_fraction_percent", "flank_bases_each_side"],
  reference: ["accession", "region_start_1based", "region_end_1based", "analyzed_span_bases", "publication_array_orientation", "published_spacer_count", "ncbi_url"],
  findings: ["detection", "preflight", "reconstruction", "orientation", "deliverables", "warnings"],
  detection: ["source_count", "array_count", "selected_array_count", "unselected_array_count", "report_count", "category_counts", "selected_category_counts", "strand_counts", "spacer_count_range", "model_score_range", "arrays"],
  array: ["array_id", "source_id", "start", "end", "category", "strand", "spacer_count", "repeat_count", "model_score", "model_score_is_probability", "selected_for_analysis"],
  preflight: ["input_array_count", "selected_array_count", "modeled_arrays", "eligible_groups", "excluded_arrays", "unknown_strand_excluded_count", "skipped_by_reason", "groups"],
  group: ["name", "array_count"],
  reconstruction: ["selected_reconstruction_count", "tree_policy", "totals", "groups"],
  totals: ["insertions", "deletions", "duplications", "rearrangements"],
  reconstructionGroup: ["name", "Deletion model preferred by LRT", "ln_lh_bdm", "reversed_ln_lh_bdm", "ln_lh_bdm - reversed_ln_lh_bdm", "nb of reconstructed insertions", "nb of reconstructed deletions", "nb of reconstructed duplications", "nb of reconstructed rearrangements", "nb of unique spacers", "nb of spacers in model matrix", "nb of leafs (after combining non-uniques)", "deletion_rate_bdm", "insertion_rate_bdm", "run_time", "predicted orientation", "recommend reversing array"],
  orientation: ["status", "tree_policy", "comparison_count", "decisive_count", "unresolved_count", "strongest_group", "strongest_delta_ln_likelihood", "confidence_threshold", "decision", "comparisons"],
  comparison: ["group", "prediction", "recommended_reverse", "decisive", "confidence_threshold", "forward_ln_likelihood_bdm", "reverse_ln_likelihood_bdm", "forward_minus_reverse_ln_likelihood_bdm", "decision"],
  deliverables: ["registered_artifact_count", "zero_registered_artifact_count", "logical_outputs"],
  deliverable: ["name", "count", "status"],
  warning: ["code", "stage", "message"],
  release: ["backend_version", "backend_release_id", "backend_wheel_sha256", "scientific_release_manifest_sha256", "scientific_artifacts"],
  tool: ["display_name", "version", "kind", "sha256", "sha256_scope"],
  result: ["status", "mode", "summary"],
  resultSummary: ["schema_version", "pipeline_status", "detection", "adapter", "orientation", "reconstruction", "warnings", "provenance"],
  resultDetection: ["source_count", "array_count", "selected_array_count", "unselected_array_count", "category_counts", "selected_category_counts", "score_semantics", "arrays", "arrays_truncated"],
  scoreSemantics: ["primary_interpretation", "model_score_is_probability", "note"],
  resultAdapter: ["input_array_count", "selected_array_count", "emitted_array_count", "emitted_group_count", "skipped_array_count", "unknown_strand_excluded_count", "skipped_by_reason", "groups"],
  resultOrientation: ["status", "tree_policy", "comparisons", "comparisons_truncated", "selected_reconstructions", "selected_reconstructions_truncated"],
  provenance: ["versions", "parameters"],
  parameters: ["mode", "category_policy", "spacer_edit_distance", "bias_corrections", "tree_policy"],
  snapshot: ["generated_at", "run_prefix", "production_run_started_at", "production_run_finished_at", "operational_warnings_omitted_from_results_panel", "public_data_policy", "sanitizer"],
};

function fail() {
  throw new Error("The example result is incomplete or incompatible with this interface.");
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, shape, path) {
  if (!isObject(value)) fail();
  const allowed = new Set(shape);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key) || FORBIDDEN_KEY.test(key)) fail();
  }
}

function assertDynamicObject(value, label) {
  if (!isObject(value)) fail();
  for (const [key, item] of Object.entries(value)) {
    if (!String(key).trim() || FORBIDDEN_KEY.test(key)) fail();
    scanScalar(key);
    scanAny(item, label);
  }
}

function scanScalar(value) {
  if (typeof value !== "string") return;
  if (value.length >= 20 && DNA_ONLY.test(value)) fail();
  if (SEQUENCE_EXTENSION.test(value)) fail();
  if (/repeat_[0-9a-f]{8,}/i.test(value)) fail();
}

function scanAny(value) {
  if (typeof value === "string") scanScalar(value);
  else if (Array.isArray(value)) value.forEach(scanAny);
  else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) fail();
      scanScalar(key);
      scanAny(item);
    }
  }
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function integer(value) {
  return Number.isInteger(Number(value));
}

function validateReference(record) {
  assertObject(record, SHAPES.reference, "reference");
  if (!/^([A-Z]{1,4}_?\d+)\.\d+$/.test(record.accession)) fail();
  if (!/^https:\/\/www\.ncbi\.nlm\.nih\.gov\/nuccore\/[A-Z]{1,4}_?\d+\.\d+$/.test(record.ncbi_url)) fail();
  if (!integer(record.region_start_1based) || !integer(record.region_end_1based) || !integer(record.analyzed_span_bases)) fail();
  if (record.region_start_1based <= 0 || record.region_end_1based < record.region_start_1based) fail();
  if (record.region_end_1based - record.region_start_1based + 1 !== record.analyzed_span_bases) fail();
  if (!["+", "-"].includes(record.publication_array_orientation)) fail();
  if (!integer(record.published_spacer_count) || record.published_spacer_count <= 0) fail();
}

function validateArrayRow(array) {
  assertObject(array, SHAPES.array, "array");
  if (!/^array_\d{3}$/.test(array.array_id)) fail();
  if (!/^([A-Z]{1,4}_?\d+)\.\d+$/.test(array.source_id)) fail();
  for (const key of ["start", "end", "spacer_count", "repeat_count"]) {
    if (!integer(array[key]) || array[key] < 0) fail();
  }
  if (array.end < array.start) fail();
  if (!finite(array.model_score)) fail();
  if (!["Bona-fide", "Possible", "Possible discarded", "Low score"].includes(array.category)) fail();
  if (!["+", "-", "Unknown"].includes(array.strand)) fail();
}

function validateComparison(comparison) {
  assertObject(comparison, SHAPES.comparison, "comparison");
  if (!/^cohort_\d{3}$/.test(comparison.group)) fail();
  for (const key of ["confidence_threshold", "forward_ln_likelihood_bdm", "reverse_ln_likelihood_bdm", "forward_minus_reverse_ln_likelihood_bdm"]) {
    if (!finite(comparison[key])) fail();
  }
  const delta = comparison.forward_ln_likelihood_bdm - comparison.reverse_ln_likelihood_bdm;
  if (Math.abs(delta - comparison.forward_minus_reverse_ln_likelihood_bdm) > 1e-9) fail();
  const expected = delta > comparison.confidence_threshold ? "Forward" : delta < -comparison.confidence_threshold ? "Reverse" : "Unresolved";
  if (comparison.decision !== expected) fail();
  if (!["Forward", "Reverse", "Unresolved"].includes(comparison.prediction)) fail();
}

function validateResult(result) {
  assertObject(result, SHAPES.result, "result");
  if (result.status !== "completed" || result.mode !== "orientation") fail();
  const summary = result.summary;
  assertObject(summary, SHAPES.resultSummary, "result.summary");
  assertObject(summary.detection, SHAPES.resultDetection, "result.summary.detection");
  assertObject(summary.adapter, SHAPES.resultAdapter, "result.summary.adapter");
  assertObject(summary.orientation, SHAPES.resultOrientation, "result.summary.orientation");
  if (summary.reconstruction !== null) fail();
  if (!Array.isArray(summary.warnings) || summary.warnings.length !== 0) fail();
  assertObject(summary.provenance, SHAPES.provenance, "provenance");
  assertDynamicObject(summary.provenance.versions, "versions");
  assertObject(summary.provenance.parameters, SHAPES.parameters, "parameters");
  summary.detection.arrays.forEach(validateArrayRow);
  summary.adapter.groups.forEach((group) => assertObject(group, SHAPES.group, "group"));
  summary.orientation.comparisons.forEach(validateComparison);
  summary.orientation.selected_reconstructions.forEach((row) => assertObject(row, SHAPES.reconstructionGroup, "reconstruction"));
}

export function validateExampleSnapshot(value) {
  assertObject(value, ROOT_KEYS, "root");
  scanAny(value);
  assertObject(value.schema, SHAPES.schema, "schema");
  if (value.schema.name !== "crispr-evolution-web-example" || value.schema.version !== EXAMPLE_SCHEMA_VERSION) fail();
  assertObject(value.example, SHAPES.example, "example");
  assertObject(value.sources, SHAPES.sources, "sources");
  if (!Array.isArray(value.references) || value.references.length !== REFERENCE_COUNT) fail();
  value.references.forEach(validateReference);
  if (new Set(value.references.map((record) => record.accession)).size !== REFERENCE_COUNT) fail();
  if (new Set(value.references.map((record) => record.ncbi_url)).size !== REFERENCE_COUNT) fail();
  const span = value.references.reduce((sum, record) => sum + record.analyzed_span_bases, 0);
  if (span !== ANALYZED_SPAN_BASES || value.sources.analyzed_span_bases !== ANALYZED_SPAN_BASES) fail();
  if (value.sources.source_genome_total_bases !== SOURCE_GENOME_TOTAL_BASES) fail();
  if (Math.abs(value.sources.analyzed_fraction_percent - ((ANALYZED_SPAN_BASES / SOURCE_GENOME_TOTAL_BASES) * 100)) > 1e-12) fail();

  assertObject(value.findings, SHAPES.findings, "findings");
  const { detection, preflight, reconstruction, orientation, deliverables } = value.findings;
  assertObject(detection, SHAPES.detection, "detection");
  assertObject(preflight, SHAPES.preflight, "preflight");
  assertObject(reconstruction, SHAPES.reconstruction, "reconstruction");
  assertObject(reconstruction.totals, SHAPES.totals, "totals");
  assertObject(orientation, SHAPES.orientation, "orientation");
  assertObject(deliverables, SHAPES.deliverables, "deliverables");
  if (!Array.isArray(detection.arrays) || detection.arrays.length !== detection.array_count) fail();
  detection.arrays.forEach(validateArrayRow);
  preflight.groups.forEach((group) => assertObject(group, SHAPES.group, "group"));
  reconstruction.groups.forEach((row) => assertObject(row, SHAPES.reconstructionGroup, "reconstruction group"));
  orientation.comparisons.forEach(validateComparison);
  if (orientation.comparison_count !== orientation.comparisons.length) fail();
  if (orientation.decisive_count + orientation.unresolved_count !== orientation.comparisons.length) fail();
  if (!finite(orientation.strongest_delta_ln_likelihood) || !finite(orientation.confidence_threshold)) fail();
  if (!["Forward", "Reverse", "Unresolved"].includes(orientation.decision)) fail();
  if (deliverables.zero_registered_artifact_count !== 0 || deliverables.registered_artifact_count <= 0) fail();
  if (!Array.isArray(deliverables.logical_outputs) || deliverables.logical_outputs.length === 0) fail();
  deliverables.logical_outputs.forEach((item) => {
    assertObject(item, SHAPES.deliverable, "deliverable");
    if (!integer(item.count) || item.count <= 0 || item.status !== "nonempty") fail();
  });
  if (!Array.isArray(value.findings.warnings)) fail();
  value.findings.warnings.forEach((warning) => assertObject(warning, SHAPES.warning, "warning"));

  assertObject(value.release, SHAPES.release, "release");
  assertDynamicObject(value.release.scientific_artifacts, "scientific artifacts");
  for (const tool of Object.values(value.release.scientific_artifacts)) assertObject(tool, SHAPES.tool, "tool");
  validateResult(value.result);
  assertObject(value.snapshot, SHAPES.snapshot, "snapshot");
  if (!/^\w{8}$/.test(value.snapshot.run_prefix)) fail();
  return value;
}
