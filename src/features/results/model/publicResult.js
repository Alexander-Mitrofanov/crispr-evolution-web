import { normalizeAdapter } from "./adapter.js";
import { normalizeDetection } from "./detection.js";
import { normalizeOrientation } from "./orientation.js";
import { normalizeProvenance } from "./provenance.js";
import { normalizeReconstruction } from "./reconstruction.js";
import { firstRecord } from "./values.js";

export function normalizePublicResult(value, context = {}) {
  const summary = firstRecord(value) || {};
  return {
    ...summary,
    ...normalizeProvenance(summary, context),
    adapter: normalizeAdapter(summary),
    detection: normalizeDetection(summary),
    orientation: normalizeOrientation(summary),
    reconstruction: normalizeReconstruction(summary),
  };
}
