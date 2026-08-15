import { inspectFasta } from "./fasta.js";

export const EXAMPLE_FASTA_PATH = "example-input.fasta";
export const EXAMPLE_RESULT_PATH = "example-result.json";
export const EXAMPLE_SCHEMA_VERSION = "1.3.0";

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
const FORBIDDEN_IDENTITY = /(?:CP|FR|LN|LR|AP)\d{6}/i;

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

function canonicalInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseNewick(value) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source || source.length > 10_000) fail();
  let position = 0;
  const skip = () => {
    while (position < source.length && /\s/.test(source[position])) position += 1;
  };
  const readLabel = () => {
    skip();
    const start = position;
    while (position < source.length && /[A-Za-z0-9_.+|\-]/.test(source[position])) position += 1;
    if (start === position) fail();
    return source.slice(start, position);
  };
  const readLength = () => {
    skip();
    if (source[position] !== ":") fail();
    position += 1;
    skip();
    const match = source.slice(position).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) fail();
    position += match[0].length;
    const length = Number(match[0]);
    if (!Number.isFinite(length) || length < 0) fail();
    return length;
  };
  const readNode = () => {
    skip();
    const children = [];
    if (source[position] === "(") {
      position += 1;
      children.push(readNode());
      while (true) {
        skip();
        if (source[position] !== ",") break;
        position += 1;
        children.push(readNode());
      }
      skip();
      if (source[position] !== ")" || children.length < 2) fail();
      position += 1;
    }
    const name = readLabel();
    return { name, length: readLength(), children };
  };
  const root = readNode();
  skip();
  if (source[position] !== ";") fail();
  position += 1;
  skip();
  if (position !== source.length) fail();
  const nodeNames = [];
  const leaves = [];
  const leafDistances = [];
  let totalLength = 0;
  const visit = (node, distance) => {
    nodeNames.push(node.name);
    totalLength += node.length;
    const nextDistance = distance + node.length;
    if (node.children.length) node.children.forEach((child) => visit(child, nextDistance));
    else {
      leaves.push(node.name);
      leafDistances.push(nextDistance);
    }
  };
  visit(root, 0);
  if (new Set(nodeNames).size !== nodeNames.length || leaves.length < 2) fail();
  return { nodeNames, leaves, totalLength, height: Math.max(...leafDistances) };
}

const RECONSTRUCTION_KEYS = new Set([
  "group", "hypothesis", "newick", "spacer_order", "nodes", "acquisition_count", "deletion_count",
]);
const RECONSTRUCTION_NODE_KEYS = new Set([
  "name", "spacers", "gains", "loss_blocks", "contradictions", "duplications", "rearrangements",
  "reacquisitions", "independent_gains", "other_duplication_events",
]);
const SPECIAL_EVENT_FIELDS = [
  "contradictions", "duplications", "rearrangements", "reacquisitions", "independent_gains",
  "other_duplication_events",
];

function validateSpacerIds(values, canonicalIds, { allowEmpty = true } = {}) {
  if (
    !Array.isArray(values)
    || (!allowEmpty && values.length === 0)
    || values.some((value) => !canonicalInteger(value) || !canonicalIds.has(value))
    || new Set(values).size !== values.length
  ) fail();
}

function validateCanonicalReconstruction(reconstruction, treeNewick, group, members) {
  if (
    !object(reconstruction)
    || Object.keys(reconstruction).some((key) => !RECONSTRUCTION_KEYS.has(key))
    || Object.keys(reconstruction).length !== RECONSTRUCTION_KEYS.size
    || reconstruction.group !== group
    || reconstruction.newick !== treeNewick
    || !Array.isArray(reconstruction.spacer_order)
    || !Array.isArray(reconstruction.nodes)
    || !nonNegativeInteger(reconstruction.acquisition_count)
    || !nonNegativeInteger(reconstruction.deletion_count)
  ) fail();
  const canonicalIds = new Set(reconstruction.spacer_order);
  if (
    canonicalIds.size !== reconstruction.spacer_order.length
    || reconstruction.spacer_order.some((value) => !canonicalInteger(value))
    || [...canonicalIds].sort((left, right) => left - right).some((value, index) => value !== index + 1)
  ) fail();
  const tree = parseNewick(treeNewick);
  const treeNodeNames = new Set(tree.nodeNames);
  const nodesByName = new Map();
  let acquisitionCount = 0;
  let deletionCount = 0;
  const specialCounts = Object.fromEntries(SPECIAL_EVENT_FIELDS.map((field) => [field, 0]));
  for (const node of reconstruction.nodes) {
    if (
      !object(node)
      || Object.keys(node).some((key) => !RECONSTRUCTION_NODE_KEYS.has(key))
      || Object.keys(node).length !== RECONSTRUCTION_NODE_KEYS.size
      || typeof node.name !== "string"
      || !treeNodeNames.has(node.name)
      || nodesByName.has(node.name)
    ) fail();
    validateSpacerIds(node.spacers, canonicalIds);
    validateSpacerIds(node.gains, canonicalIds);
    if (!Array.isArray(node.loss_blocks)) fail();
    const flattenedLosses = [];
    for (const block of node.loss_blocks) {
      validateSpacerIds(block, canonicalIds, { allowEmpty: false });
      flattenedLosses.push(...block);
    }
    if (new Set(flattenedLosses).size !== flattenedLosses.length) fail();
    for (const field of SPECIAL_EVENT_FIELDS) {
      validateSpacerIds(node[field], canonicalIds);
      specialCounts[field] += node[field].length;
    }
    acquisitionCount += node.gains.length;
    deletionCount += flattenedLosses.length;
    nodesByName.set(node.name, node);
  }
  if (
    nodesByName.size !== treeNodeNames.size
    || reconstruction.nodes.length !== treeNodeNames.size
    || acquisitionCount !== reconstruction.acquisition_count
    || deletionCount !== reconstruction.deletion_count
  ) fail();
  const memberBySource = new Map(members.map((member) => [String(member.source_id), member]));
  if (tree.leaves.length !== memberBySource.size) fail();
  const leafSpacers = new Map();
  for (const leaf of tree.leaves) {
    const member = memberBySource.get(leaf);
    const node = nodesByName.get(leaf);
    if (!member || !node || node.spacers.length !== Number(member.spacer_count)) fail();
    leafSpacers.set(leaf, [...node.spacers].sort((left, right) => left - right));
  }
  return { canonicalIds, leafSpacers, specialCounts, tree };
}

function validateEvolutionaryReconstructions(summary, mainGroup, comparison, selectedReconstruction) {
  const orientation = summary.orientation;
  const trees = orientation.trees;
  const reconstructions = orientation.reconstructions;
  if (
    !Array.isArray(trees)
    || trees.length !== summary.adapter.groups.length
    || orientation.trees_truncated !== false
    || !Array.isArray(reconstructions)
    || reconstructions.length !== summary.adapter.groups.length * 2
    || orientation.reconstructions_truncated !== false
  ) fail();
  const treeRow = trees.find((item) => item?.group === mainGroup.name);
  const groupReconstructions = reconstructions.filter((item) => item?.group === mainGroup.name);
  const input = groupReconstructions.find((item) => item.hypothesis === "input");
  const reverse = groupReconstructions.find((item) => item.hypothesis === "reverse");
  const selectedHypothesis = comparison.prediction === "Reverse" ? "reverse" : "input";
  const expectedSelectedTree = selectedHypothesis === "reverse" ? treeRow?.reverse_newick : treeRow?.forward_newick;
  if (
    !object(treeRow)
    || Object.keys(treeRow).some((key) => !["group", "forward_newick", "reverse_newick", "selected_newick"].includes(key))
    || Object.keys(treeRow).length !== 4
    || groupReconstructions.length !== 2
    || !input
    || !reverse
    || input.hypothesis !== "input"
    || reverse.hypothesis !== "reverse"
    || treeRow.selected_newick !== expectedSelectedTree
  ) fail();
  const inputResult = validateCanonicalReconstruction(input, treeRow.forward_newick, mainGroup.name, mainGroup.arrays);
  const reverseResult = validateCanonicalReconstruction(reverse, treeRow.reverse_newick, mainGroup.name, mainGroup.arrays);
  if (
    inputResult.canonicalIds.size !== reverseResult.canonicalIds.size
    || [...inputResult.canonicalIds].some((value) => !reverseResult.canonicalIds.has(value))
  ) fail();
  for (const [leaf, spacers] of inputResult.leafSpacers) {
    if (spacers.join(",") !== reverseResult.leafSpacers.get(leaf)?.join(",")) fail();
  }
  const selected = selectedHypothesis === "reverse" ? reverse : input;
  const selectedResult = selectedHypothesis === "reverse" ? reverseResult : inputResult;
  const serializedTreeTolerance = (selectedResult.tree.nodeNames.length + 1) * 0.0000051;
  if (
    selected.newick !== treeRow.selected_newick
    || selected.acquisition_count !== Number(selectedReconstruction["nb of reconstructed insertions"])
    || selected.deletion_count !== Number(selectedReconstruction["nb of reconstructed deletions"])
    || selectedResult.canonicalIds.size !== Number(selectedReconstruction["nb of unique spacers"])
    || selectedResult.tree.leaves.length !== Number(selectedReconstruction["nb of leafs (after combining non-uniques)"])
    || !finite(selectedReconstruction["tree length"])
    || !finite(selectedReconstruction["tree height"])
    || Math.abs(selectedResult.tree.totalLength - Number(selectedReconstruction["tree length"])) > serializedTreeTolerance
    || Math.abs(selectedResult.tree.height - Number(selectedReconstruction["tree height"])) > serializedTreeTolerance
  ) fail();
  const specialMetrics = {
    duplications: "nb of reconstructed duplications",
    rearrangements: "nb of reconstructed rearrangements",
    reacquisitions: "nb of reconstructed reacquisitions",
    independent_gains: "nb of reconstructed independent gains",
    other_duplication_events: "nb of reconstructed other dup. events",
  };
  for (const [eventField, metricField] of Object.entries(specialMetrics)) {
    if (selectedResult.specialCounts[eventField] !== Number(selectedReconstruction[metricField])) fail();
  }
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
  const detectedSpacerCounts = detection.arrays.map((item) => Number(item.spacer_count));
  const detectedSources = new Set(detection.arrays.map((item) => String(item.source_id)));
  const observedSpacerRange = [Math.min(...detectedSpacerCounts), Math.max(...detectedSpacerCounts)];
  if (
    findings.detection.arrays !== detection.array_count
    || findings.detection.bona_fide !== (detection.category_counts?.["Bona-fide"] ?? 0)
    || findings.detection.possible !== (detection.category_counts?.Possible ?? 0)
    || findings.detection.spacer_count_range?.[0] !== observedSpacerRange[0]
    || findings.detection.spacer_count_range?.[1] !== observedSpacerRange[1]
    || findings.preflight.modeled_arrays !== adapter.emitted_array_count
    || findings.preflight.eligible_groups !== adapter.emitted_group_count
    || findings.preflight.excluded_arrays !== adapter.skipped_array_count
    || !Array.isArray(comparisons)
    || comparisons.length < 1
    || !Array.isArray(reconstructions)
    || reconstructions.length < 1
    || !Array.isArray(adapter.groups)
  ) fail();
  comparisons.forEach(validateComparison);
  const mainComparison = comparisons.find((item) => item.group === findings.orientation.group);
  const mainReconstruction = reconstructions.find((item) => item.name === findings.reconstruction.group);
  const mainGroup = adapter.groups.find((item) => item.name === findings.orientation.group);
  const delta = Number(mainComparison?.forward_minus_reverse_ln_likelihood_bdm);
  const threshold = Number(mainComparison?.confidence_threshold);
  const expectedDecision = delta > threshold
    ? "Input order supported"
    : delta < -threshold
      ? "Reverse input order supported"
      : "Unresolved";
  if (
    !mainComparison
    || !mainReconstruction
    || !mainGroup
    || findings.reconstruction.group !== findings.orientation.group
    || findings.orientation.delta_ln_likelihood !== mainComparison.forward_minus_reverse_ln_likelihood_bdm
    || findings.orientation.confidence_threshold !== mainComparison.confidence_threshold
    || findings.orientation.decision !== expectedDecision
    || expectedDecision === "Unresolved"
    || mainComparison.decisive !== true
    || Math.abs(delta) <= threshold
    || !Array.isArray(mainGroup.arrays)
    || mainGroup.arrays.length !== mainGroup.array_count
    || mainGroup.arrays.length !== findings.reconstruction.array_count
    || mainGroup.arrays.some((item) => !detectedSources.has(String(item.source_id)))
    || mainGroup.arrays_truncated !== false
    || typeof mainGroup.repeat_key !== "string"
    || !mainGroup.repeat_key
    || findings.reconstruction.unique_spacers !== mainReconstruction["nb of unique spacers"]
    || findings.reconstruction.insertions !== mainReconstruction["nb of reconstructed insertions"]
    || findings.reconstruction.deletions !== mainReconstruction["nb of reconstructed deletions"]
    || findings.reconstruction.duplications !== mainReconstruction["nb of reconstructed duplications"]
    || findings.reconstruction.preferred_deletion_model !== mainReconstruction["Deletion model preferred by LRT"]
  ) fail();
  validateEvolutionaryReconstructions(summary, mainGroup, mainComparison, mainReconstruction);
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
