import { finiteMetric, getValue } from "./formatting.js";

export const reconstructionMetric = (row, name) => {
  const keys = {
    acquisitions: ["nb of reconstructed insertions", "gains", "insertions", "gain_events"],
    deletions: ["nb of reconstructed deletions", "deletions", "losses", "deletion_events"],
    unique: ["nb of unique spacers", "unique_spacers"],
    aligned: ["nb of spacers in alignment", "nb of spacers in model matrix", "alignment_spacers", "aligned_spacers"],
    patterns: ["nb of unique spacer arrays", "unique_arrays"],
    leaves: ["nb of leafs (after combining non-uniques)", "leaf_count"],
    lrt: ["test_statistic (-2*ln_lh_ratio)", "likelihood_ratio_statistic"],
    cutoff: ["chi2_quantile", "model_selection_cutoff"],
    idmLikelihood: ["ln_lh_idm", "idm_log_likelihood"],
    bdmLikelihood: ["ln_lh_bdm", "log_likelihood", "ln_likelihood", "lnL"],
    duplications: ["nb of reconstructed duplications", "duplications"],
    rearrangements: ["nb of reconstructed rearrangements", "rearrangements"],
    reacquisitions: ["nb of reconstructed reacquisitions", "reacquisitions"],
    independentGains: ["nb of reconstructed independent gains", "independent_gains"],
  }[name] || [];
  return finiteMetric(getValue(row, ...keys));
};

export const preferredDeletionModel = (row) => String(getValue(row, "Deletion model preferred by LRT", "preferred_model", "model_name", "model") || "Not reported");
