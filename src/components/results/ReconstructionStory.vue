<script setup>
import { computed } from "vue";

import { asArray, finiteMetric, formatNumber, getValue } from "../../utils/formatting.js";
import { comparisonDecisionFor, groupIdentity } from "../../utils/results.js";
import AncestralHistoryExplorer from "./AncestralHistoryExplorer.vue";

const props = defineProps({ row: { type: Object, required: true }, index: { type: Number, required: true }, summary: { type: Object, required: true } });
const group = computed(() => String(props.row.name || props.row.group || `Group ${props.index + 1}`));
const orientation = computed(() => props.summary?.orientation || {});
const comparison = computed(() => asArray(orientation.value.comparisons).find((item, index) => groupIdentity(item, index) === group.value));
const reportedByDefault = computed(() => !comparison.value || comparisonDecisionFor(comparison.value, orientation.value).label === "Unresolved");
const tree = computed(() => {
  const entry = [...asArray(orientation.value.trees), ...asArray(props.summary?.reconstruction?.trees)].find((item) => String(item?.group || item?.name) === group.value);
  return entry?.selected_newick || entry?.newick || "";
});
const acquisitions = computed(() => finiteMetric(getValue(props.row, "nb of reconstructed insertions", "gains", "insertions")) ?? 0);
const deletions = computed(() => finiteMetric(getValue(props.row, "nb of reconstructed deletions", "deletions", "losses")) ?? 0);
const totalEvents = computed(() => Math.max(1, acquisitions.value + deletions.value));
const preferredModel = computed(() => getValue(props.row, "Deletion model preferred by LRT", "preferred_model", "model_name", "model") || "Not reported");
</script>

<template>
  <article :class="['reconstruction-story', `group-tone-${index % 4}`]">
    <div class="reconstruction-story-heading"><div><small>Reconstructed group {{ index + 1 }}</small><h4>{{ group }}</h4></div><span>{{ formatNumber(getValue(row, 'nb of leafs (after combining non-uniques)', 'leaf_count')) }} leaves</span></div>
    <div class="spacerplacer-verdict"><span><small>Preferred deletion model</small><strong>{{ preferredModel }}</strong></span><span><small>BDM lnL</small><strong>{{ formatNumber(getValue(row, 'ln_lh_bdm', 'log_likelihood', 'ln_likelihood'), 3) }}</strong></span><span><small>Tree length</small><strong>{{ formatNumber(getValue(row, 'tree length', 'tree_length'), 4) }}</strong></span></div>
    <AncestralHistoryExplorer :summary="summary" :group="group" :fallback-tree="tree" :reported-by-default="reportedByDefault"/>
    <div class="reconstruction-visual-grid"><div class="event-graphic"><div class="graphic-label"><span>Reconstructed event totals</span><small>Reported ancestral history</small></div><div class="event-ribbon" :aria-label="`${acquisitions} acquisitions and ${deletions} deletions`"><span class="event-ribbon-gains" :style="{ width: `${Math.max(12, acquisitions / totalEvents * 100)}%` }"><b>{{ formatNumber(acquisitions) }}</b><small>acquisitions</small></span><span class="event-ribbon-losses" :style="{ width: `${Math.max(12, deletions / totalEvents * 100)}%` }"><b>{{ formatNumber(deletions) }}</b><small>deletions</small></span></div><p>Green denotes acquisitions and red denotes deletions in the reported history.</p></div><div class="model-gauge"><div class="graphic-label"><span>Deletion model evidence</span><small>LRT-selected model</small></div><strong>{{ preferredModel }}</strong><p>Model selection and rate estimates are conditional on the reconstructed tree and arrays.</p></div></div>
    <div class="spacer-inventory"><span><small>Unique spacers</small><strong>{{ formatNumber(getValue(row, 'nb of unique spacers', 'unique_spacers')) }}</strong></span><span><small>Aligned spacers</small><strong>{{ formatNumber(getValue(row, 'nb of spacers in alignment', 'aligned_spacers')) }}</strong></span><span><small>Unique array patterns</small><strong>{{ formatNumber(getValue(row, 'nb of unique spacer arrays', 'unique_arrays')) }}</strong></span></div>
  </article>
</template>
