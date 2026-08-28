<script setup>
import { computed } from "vue";

import { asArray, finiteMetric, formatNumber, signedNumber } from "../../../utils/formatting.js";
import { comparisonDecisionFor } from "../../../utils/results.js";

const props = defineProps({
  summary: { type: Object, required: true },
  exampleSnapshot: { type: Object, default: null },
  noEligible: Boolean,
});
const cards = computed(() => {
  const detection = props.summary.detection;
  const adapter = props.summary.adapter;
  const orientation = props.summary.orientation || {};
  const comparison = asArray(orientation.comparisons)[0];
  const reconstruction = (
    asArray(orientation.selected_reconstructions).length
      ? asArray(orientation.selected_reconstructions)
      : asArray(props.summary?.reconstruction?.results)
  )[0];
  const categories = detection.category_counts;
  const arrayCount =
    finiteMetric(detection.array_count) ??
    (Object.values(categories).reduce((total, value) => total + (finiteMetric(value) ?? 0), 0) ||
      asArray(detection.arrays).length);
  const modeled = finiteMetric(adapter.emitted_array_count);
  const groups = finiteMetric(adapter.emitted_group_count);
  const delta = finiteMetric(comparison?.forward_minus_reverse_ln_likelihood_bdm);
  const decision = comparison ? comparisonDecisionFor(comparison, orientation).label : null;
  const acquisitions = finiteMetric(reconstruction?.acquisitions);
  const deletions = finiteMetric(reconstruction?.deletions);
  return [
    {
      label: "Detection",
      value: `${formatNumber(categories["Bona-fide"] ?? 0)} / ${formatNumber(arrayCount)}`,
      detail: "Bona-fide arrays",
    },
    {
      label: "Model input",
      value:
        modeled == null || groups == null
          ? "Not reported"
          : `${formatNumber(modeled)} → ${formatNumber(groups)}`,
      detail: "arrays → eligible groups",
    },
    {
      label: "Orientation evidence",
      value: delta == null ? "Not evaluated" : `Δ lnL ${signedNumber(delta, 2)}`,
      detail: decision || "No decision",
    },
    {
      label: "Reported history",
      value:
        acquisitions == null || deletions == null
          ? "Not reconstructed"
          : `${formatNumber(acquisitions)} / ${formatNumber(deletions)}`,
      detail: "acquisitions / deletions",
    },
  ];
});
const takeaway = computed(
  () =>
    props.exampleSnapshot?.example?.analysis_takeaway ||
    (props.noEligible
      ? "CRISPR detection completed, but no group met the requirements for evolutionary comparison."
      : "Detection and reconstruction completed; inspect each evidence layer and its warnings below."),
);
</script>

<template>
  <section
    :class="['result-synopsis', { 'precomputed-synopsis': exampleSnapshot?.example }]"
    aria-labelledby="synopsis-heading"
  >
    <div class="synopsis-copy">
      <p class="eyebrow">
        {{
          exampleSnapshot?.example ? "Precomputed example · biological question" : "Result synopsis"
        }}
      </p>
      <h3 id="synopsis-heading">
        {{ exampleSnapshot?.example?.analysis_question || "What does this run support?" }}
      </h3>
      <p>{{ takeaway }}</p>
    </div>
    <div class="synopsis-cards">
      <div
        v-for="card in cards"
        :key="card.label"
      >
        <span>{{ card.label }}</span
        ><strong>{{ card.value }}</strong
        ><small>{{ card.detail }}</small>
      </div>
    </div>
  </section>
</template>
