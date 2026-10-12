import { asRecord } from "./values.js";
import {
  available,
  count,
  counts,
  labels,
  metric,
  probability,
  rows,
  text,
} from "./contextValues.js";

export function normalizeRnaFamily(value) {
  const doc = asRecord(value) || {};
  return {
    available: available(doc),
    counts: counts(doc.counts, [
      "sources",
      "unique_sequences",
      "alignment_columns",
      "mfe_pairs",
      "retained_probabilities",
    ]),
    policy: Object.fromEntries(
      ["weights", "orientation", "boundaries", "homology"].map((key) => [
        key,
        text(doc.policy?.[key]),
      ]),
    ),
    fold: {
      consensus: text(doc.fold?.consensus),
      structure: text(doc.fold?.structure),
      mfe_score_kcal_mol: metric(doc.fold?.mfe_score_kcal_mol),
      ensemble_free_energy_kcal_mol: metric(doc.fold?.ensemble_free_energy_kcal_mol),
      temperature_celsius: metric(doc.fold?.temperature_celsius),
    },
    alignment: rows(doc.alignment, 50).map((row) => ({
      id: text(row.id),
      member_ids: labels(row.member_ids, 50),
      sequence: text(row.sequence),
    })),
    pairs: rows(doc.pairs, 1000).map((row) => ({
      left: count(row.left),
      right: count(row.right),
      probability: probability(row.probability),
      canonical_sequences: count(row.canonical_sequences),
      noncanonical_sequences: count(row.noncanonical_sequences),
      gapped_sequences: count(row.gapped_sequences),
      compensatory_sequence_pairs: count(row.compensatory_sequence_pairs),
      pair_types: labels(row.pair_types, 16),
    })),
    warnings: labels(doc.warnings, 50),
  };
}
