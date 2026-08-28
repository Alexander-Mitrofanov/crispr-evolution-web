import { asList, firstDefined, firstRecord } from "./values.js";

export function normalizeDetectionArray(value) {
  const row = firstRecord(value) || {};
  return {
    ...row,
    array_id: firstDefined(row, "array_id", "id", "Name"),
    category: firstDefined(row, "category", "Category"),
    end: firstDefined(row, "end", "End"),
    model_score: firstDefined(row, "model_score", "score", "Confidence score"),
    source_id: firstDefined(row, "source_id", "record_id", "sequence_id", "Name"),
    spacer_count: firstDefined(row, "spacer_count", "Number of spacers"),
    start: firstDefined(row, "start", "Start"),
    strand: firstDefined(row, "strand", "Strand"),
  };
}

export function normalizeDetection(summary) {
  const source = firstRecord(summary?.detection, summary) || {};
  const arrays = asList(firstDefined(source, "arrays", "detected_arrays"));
  const categoryCounts = firstRecord(firstDefined(source, "category_counts", "categories"));
  return {
    ...source,
    arrays: arrays.map(normalizeDetectionArray),
    category_counts: categoryCounts || {},
  };
}
