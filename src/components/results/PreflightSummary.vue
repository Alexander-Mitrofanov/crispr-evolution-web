<script setup>
import { computed } from "vue";

import { asArray, formatNumber, getValue } from "../../utils/formatting.js";

const props = defineProps({ summary: { type: Object, required: true } });
const adapter = computed(() => props.summary?.adapter || props.summary?.preflight || props.summary?.group_preflight || {});
const reasons = computed(() => {
  const value = adapter.value.skipped_by_reason || adapter.value.skip_reasons || adapter.value.exclusion_reasons;
  return Array.isArray(value) ? value.map((item) => [item.reason || item.code || "Other", item.count ?? 1]) : Object.entries(value || {});
});
const metrics = computed(() => [
  ["Retained arrays", getValue(adapter.value, "emitted_array_count", "retained_arrays", "retained")],
  ["Excluded arrays", getValue(adapter.value, "skipped_array_count", "excluded_arrays", "excluded")],
  ["Eligible groups", getValue(adapter.value, "emitted_group_count", "eligible_groups", "groups")],
  ["Unknown strand excluded", getValue(adapter.value, "unknown_strand_excluded_count", "unknown_strand", "unknown_strand_arrays") ?? 0],
]);
</script>

<template>
  <section v-if="Object.keys(adapter).length" class="result-section" aria-labelledby="preflight-heading">
    <div class="result-heading"><div><p class="eyebrow">Evolution preflight</p><h3 id="preflight-heading">What reached the model</h3></div><p>Filtering is reported before reconstruction so absence of a result is explainable.</p></div>
    <div class="metric-grid"><div v-for="([label, value], index) in metrics" :key="label" :class="{ attention: index === 3 && Number(value) > 0 }"><span>{{ label }}</span><strong>{{ formatNumber(value) }}</strong></div></div>
    <div class="reason-block"><h4>Exclusion and skip reasons</h4><p v-if="!reasons.length" class="muted">No exclusions were reported.</p><ul v-else class="reason-list"><li v-for="[reason, count] in reasons" :key="reason"><span>{{ String(reason).replaceAll('_', ' ') }}</span><b>{{ formatNumber(count) }}</b></li></ul></div>
  </section>
</template>
