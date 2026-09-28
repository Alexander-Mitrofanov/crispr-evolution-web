export function buildSubmission({ sequence, filename, mode, options }) {
  return {
    sequence,
    filename,
    mode,
    ...(mode === "viral_search" ? { viral_max_mismatches: options.viralMaxMismatches ?? 2 } : {}),
    ...(mode === "repeats" ? { molecule: options.molecule || "DNA" } : {}),
    ...(["loci", "tracrrna"].includes(mode)
      ? { tracr_model_type: options.tracrModelType || "II" }
      : {}),
    ...(["loci", "leader"].includes(mode)
      ? { leader_flank_length: options.leaderFlankLength ?? 500 }
      : {}),
    category_policy: options.categoryPolicy,
    spacer_distance: options.spacerEditDistance,
    bias_corrections: options.biasCorrection,
  };
}
