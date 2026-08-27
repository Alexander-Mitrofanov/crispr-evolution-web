<script setup>
import { computed } from "vue";

import { asArray, finiteMetric, formatNumber, getValue, signedNumber } from "../../utils/formatting.js";
import { comparisonDecisionFor } from "../../utils/results.js";

const props = defineProps({ summary: { type: Object, required: true }, exampleSnapshot: { type: Object, default: null }, noEligible: Boolean });
const cards = computed(() => {
  const detection = props.summary?.detection || props.summary || {};
  const adapter = props.summary?.adapter || {};
  const orientation = props.summary?.orientation || props.summary?.orientation_evidence || {};
  const comparison = asArray(orientation.comparisons || orientation.groups)[0];
  const reconstruction = (asArray(orientation.selected_reconstructions).length ? asArray(orientation.selected_reconstructions) : asArray(props.summary?.reconstruction?.results))[0];
  const categories = detection.category_counts || detection.categories || {};
  const arrayCount = finiteMetric(detection.array_count) ?? (Object.values(categories).reduce((total, value) => total + (finiteMetric(value) ?? 0), 0) || asArray(detection.arrays).length);
  const modeled = finiteMetric(getValue(adapter, "emitted_array_count", "retained_arrays"));
  const groups = finiteMetric(getValue(adapter, "emitted_group_count", "eligible_groups"));
  const delta = finiteMetric(getValue(comparison, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL"));
  const decision = comparison ? comparisonDecisionFor(comparison, orientation).label : null;
  const acquisitions = finiteMetric(getValue(reconstruction, "nb of reconstructed insertions", "gains", "insertions"));
  const deletions = finiteMetric(getValue(reconstruction, "nb of reconstructed deletions", "deletions", "losses"));
  return [
    { label: "Detection", value: `${formatNumber(categories["Bona-fide"] ?? 0)} / ${formatNumber(arrayCount)}`, detail: "Bona-fide arrays" },
    { label: "Model input", value: modeled == null || groups == null ? "Not reported" : `${formatNumber(modeled)} → ${formatNumber(groups)}`, detail: "arrays → eligible groups" },
    { label: "Orientation evidence", value: delta == null ? "Not evaluated" : `Δ lnL ${signedNumber(delta, 2)}`, detail: decision || "No decision" },
    { label: "Reported history", value: acquisitions == null || deletions == null ? "Not reconstructed" : `${formatNumber(acquisitions)} / ${formatNumber(deletions)}`, detail: "acquisitions / deletions" },
  ];
});
const takeaway = computed(() => props.exampleSnapshot?.example?.analysis_takeaway || (props.noEligible ? "CRISPR detection completed, but no group met the requirements for evolutionary comparison." : "Detection and reconstruction completed; inspect each evidence layer and its warnings below."));
</script>

<template>
  <section :class="['result-synopsis', { 'precomputed-synopsis': exampleSnapshot?.example }]" aria-labelledby="synopsis-heading"><div class="synopsis-copy"><p class="eyebrow">{{ exampleSnapshot?.example ? 'Precomputed example · biological question' : 'Result synopsis' }}</p><h3 id="synopsis-heading">{{ exampleSnapshot?.example?.analysis_question || 'What does this run support?' }}</h3><p>{{ takeaway }}</p></div><div class="synopsis-cards"><div v-for="card in cards" :key="card.label"><span>{{ card.label }}</span><strong>{{ card.value }}</strong><small>{{ card.detail }}</small></div></div></section>
</template>
