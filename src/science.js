export const ANALYSIS_MODES = [
  {
    id: "detection",
    number: "01",
    title: "Detect arrays",
    short: "CRISPRidentify v2",
    description:
      "Locate and categorize candidate CRISPR arrays in one or more DNA records. No evolutionary history is inferred.",
    minimumRecords: 1,
    tools: ["CRISPRidentify v2"],
  },
  {
    id: "reconstruction",
    number: "02",
    title: "Evolution & reconstruction",
    short: "SpacerPlacer",
    description:
      "Detect arrays, form comparable groups, and reconstruct ancestral spacer content on an estimated distance tree.",
    minimumRecords: 2,
    tools: ["CRISPRidentify v2", "SpacerPlacer"],
  },
  {
    id: "orientation",
    number: "03",
    title: "Orientation-aware evolution",
    short: "CRISPR-evOr",
    badge: "Recommended for related isolates",
    description:
      "Compare input and reversed array order under the evolutionary model, including the selected SpacerPlacer reconstruction.",
    minimumRecords: 2,
    tools: ["CRISPRidentify v2", "CRISPR-evOr", "SpacerPlacer"],
  },
];

export const STAGES = [
  { id: "queued", label: "Queued", detail: "Waiting for an analysis worker" },
  { id: "validate_input", label: "Validate input", detail: "Checking records and analysis policy" },
  { id: "detect_arrays", label: "Detect arrays", detail: "CRISPRidentify v2" },
  { id: "adapt_arrays", label: "Prepare arrays", detail: "Normalizing accepted calls" },
  { id: "preflight_groups", label: "Preflight groups", detail: "Testing evolutionary eligibility" },
  { id: "reconstruct_spacer_histories", label: "Reconstruct histories", detail: "SpacerPlacer" },
  { id: "compare_orientations", label: "Compare orientations", detail: "CRISPR-evOr" },
  { id: "package_results", label: "Package results", detail: "Reports, provenance, and archive" },
];

export const TERMINAL_STATUSES = new Set([
  "completed",
  "completed_no_eligible_groups",
  "failed",
  "cancelled",
  "expired",
]);

export function stagesForMode(mode) {
  const excluded = {
    detection: new Set([
      "adapt_arrays",
      "preflight_groups",
      "reconstruct_spacer_histories",
      "compare_orientations",
    ]),
    reconstruction: new Set(["compare_orientations"]),
    orientation: new Set(),
  }[mode] || new Set();
  return STAGES.filter((stage) => !excluded.has(stage.id));
}

export function orientationLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (["forward", "input", "input_order", "input-order"].includes(normalized)) {
    return "Input order supported";
  }
  if (["reverse", "reversed", "reverse_order", "reverse-order"].includes(normalized)) {
    return "Reverse input order supported";
  }
  return "Unresolved";
}

export function categoryClass(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
