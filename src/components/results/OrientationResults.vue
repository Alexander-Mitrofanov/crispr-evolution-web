<script setup>
import { computed } from "vue";

import { categoryClass } from "../../science.js";
import { asArray, formatNumber, signedNumber } from "../../utils/formatting.js";
import { comparisonDecisionFor, groupIdentity } from "../../utils/results.js";
import AppIcon from "../common/AppIcon.vue";
import HypothesisComparison from "./HypothesisComparison.vue";

const props = defineProps({ summary: { type: Object, required: true } });
const orientation = computed(() => props.summary?.orientation || props.summary?.orientation_evidence || null);
const comparisons = computed(() => {
  if (!orientation.value) return [];
  const direct = orientation.value.delta_ln_likelihood ?? orientation.value.delta_lnL ?? orientation.value.delta_log_likelihood;
  const rows = asArray(orientation.value.comparisons).length ? asArray(orientation.value.comparisons) : asArray(orientation.value.groups || props.summary.orientation_groups);
  return rows.length ? rows : direct != null || orientation.value.decision ? [{ group: "All eligible arrays", ...orientation.value }] : [];
});
const decisions = computed(() => comparisons.value.map((item) => comparisonDecisionFor(item, orientation.value)));
const extent = computed(() => Math.max(10, ...decisions.value.map((item) => Math.max(Math.abs(item.delta || 0) * 1.18, item.threshold * 1.65))));
const position = (value) => Math.max(0, Math.min(100, ((value + extent.value) / (extent.value * 2)) * 100));
const treePolicyText = computed(() => orientation.value?.tree_policy === "estimated_separately" ? "Input-order and reversed-order model trees were estimated separately. A decisive group reports the supported history; unresolved retains input order only as a reporting default." : orientation.value?.tree_policy === "provided_shared" ? "Both hypotheses were evaluated on the same provided rooted tree." : "Consult provenance for the tree-estimation policy.");
</script>

<template>
  <section v-if="orientation" class="result-section orientation-section" aria-labelledby="orientation-heading">
    <div class="result-heading"><div><p class="eyebrow">CRISPR-evOr hypothesis test</p><h3 id="orientation-heading">Which spacer order is better supported?</h3></div><span class="orientation-chip">{{ decisions.filter((item) => item.label !== 'Unresolved').length }} decisive · {{ decisions.filter((item) => item.label === 'Unresolved').length }} unresolved</span></div>
    <p class="visual-intro">Each marker is the forward-minus-reverse BDM log-likelihood difference. Values from −5 through +5 are deliberately inconclusive.</p>
    <div v-if="comparisons.length" class="orientation-landscape" aria-label="Orientation evidence overview"><div class="orientation-landscape-header"><span>Reverse order supported</span><span>Unresolved zone</span><span>Input order supported</span></div><div class="orientation-landscape-scale"><span>{{ signedNumber(-extent, 1) }}</span><span>0</span><span>{{ signedNumber(extent, 1) }}</span></div><div class="orientation-plot-rows"><div v-for="(item, index) in comparisons" :key="groupIdentity(item, index)" :class="['orientation-plot-row', `group-tone-${index % 4}`]"><div class="orientation-plot-label"><strong>Group {{ index + 1 }}</strong><code>{{ groupIdentity(item, index) }}</code></div><svg class="orientation-axis" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" :aria-label="`Delta log likelihood ${decisions[index].delta == null ? 'not reported' : decisions[index].delta.toFixed(2)} for ${groupIdentity(item, index)}`"><rect class="orientation-zone-reverse" x="0" y="0" :width="position(-decisions[index].threshold)" height="36"/><rect class="orientation-zone-unresolved" :x="position(-decisions[index].threshold)" y="0" :width="position(decisions[index].threshold) - position(-decisions[index].threshold)" height="36"/><rect class="orientation-zone-input" :x="position(decisions[index].threshold)" y="0" :width="100 - position(decisions[index].threshold)" height="36"/><line class="orientation-zero" :x1="position(0)" y1="0" :x2="position(0)" y2="36"/><line class="orientation-marker-outline" :x1="position(decisions[index].delta || 0)" y1="0" :x2="position(decisions[index].delta || 0)" y2="36"/><line :class="['orientation-marker', `orientation-marker-${categoryClass(decisions[index].label)}`]" :x1="position(decisions[index].delta || 0)" y1="0" :x2="position(decisions[index].delta || 0)" y2="36"/></svg><span class="orientation-chip">{{ decisions[index].label }}</span></div></div></div>
    <div v-if="comparisons.length" class="hypothesis-list"><HypothesisComparison v-for="(group, index) in comparisons" :key="groupIdentity(group, index)" :group="group" :index="index" :decision="decisions[index]"/></div><div v-else class="empty-result">No finite orientation comparison was produced.</div>
    <div class="tree-policy"><span class="tree-glyph" aria-hidden="true"><AppIcon name="tree"/></span><div><strong>Tree policy: {{ String(orientation.tree_policy || 'not_reported').replaceAll('_', ' ') }}</strong><p>{{ treePolicyText }}</p></div></div>
    <div class="threshold-note"><AppIcon name="info" :size="18"/><p><strong>How to read this:</strong> positive ΔlnL favors input order; negative favors reversed order. The threshold is an evidence rule, <strong>not a p-value or probability</strong>.</p></div>
  </section>
</template>
