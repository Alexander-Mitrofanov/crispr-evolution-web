export function buildSubmission({ sequence, filename, mode, options }) {
  return {
    sequence,
    filename,
    mode,
    category_policy: options.categoryPolicy,
    spacer_distance: options.spacerEditDistance,
    bias_corrections: options.biasCorrection,
  };
}
