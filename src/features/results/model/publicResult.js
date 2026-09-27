import { normalizeAdapter } from "./adapter.js";
import { normalizeLeader } from "./leader.js";
import { normalizeRepeats } from "./repeats.js";
import { normalizeDetection } from "./detection.js";
import { normalizeOrientation } from "./orientation.js";
import { normalizeProvenance } from "./provenance.js";
import { normalizeReconstruction } from "./reconstruction.js";
import { normalizeWarnings } from "./warnings.js";
import { firstRecord } from "./values.js";

export function normalizePublicResult(value, context = {}) {
  const summary = firstRecord(value) || {};
  const provenance = normalizeProvenance(summary, context);
  return {
    ...summary,
    ...provenance,
    ...normalizeWarnings({ ...summary, ...provenance }),
    adapter: normalizeAdapter(summary),
    detection: normalizeDetection(summary),
    crisprleader: normalizeLeader(summary.crisprleader),
    repeats: normalizeRepeats(summary.repeats),
    orientation: normalizeOrientation(summary),
    reconstruction: normalizeReconstruction(summary),
  };
}
