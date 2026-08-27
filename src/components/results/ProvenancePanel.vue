<script setup>
import { computed } from "vue";

import { asArray } from "../../utils/formatting.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({ job: { type: Object, required: true }, summary: { type: Object, required: true } });
const warnings = computed(() => [...asArray(props.summary?.warnings), ...asArray(props.job?.options?.warnings), ...asArray(props.job?.warnings)].filter(Boolean));
const provenance = computed(() => props.summary?.provenance || props.job?.provenance || {});
const versions = computed(() => provenance.value.tool_versions || provenance.value.versions || {});
const parameters = computed(() => provenance.value.parameters || props.job?.options || props.job?.request?.options || {});
const displayValue = (value) => typeof value === "boolean" ? (value ? "enabled" : "disabled") : Array.isArray(value) ? value.join(", ") : value && typeof value === "object" ? JSON.stringify(value) : String(value);
</script>

<template>
  <section class="result-section provenance-section" aria-labelledby="provenance-heading">
    <div class="result-heading"><div><p class="eyebrow">Reproducibility</p><h3 id="provenance-heading">Warnings & provenance</h3></div><p>Warnings should travel with downstream interpretations.</p></div>
    <ul v-if="warnings.length" class="warning-list"><li v-for="(warning, index) in warnings" :key="`${warning?.code || 'warning'}:${index}`"><AppIcon name="warning" :size="18"/><span><strong>{{ warning.title || warning.code || 'Analysis warning' }}</strong>{{ warning.message || String(warning) }}</span></li></ul><p v-else class="no-warnings"><AppIcon name="check" :size="17"/> No workflow warnings were reported.</p>
    <div class="provenance-grid"><div><h4>Tool versions</h4><dl v-if="Object.keys(versions).length"><div v-for="(value, key) in versions" :key="key"><dt>{{ key.replaceAll('_', ' ') }}</dt><dd>{{ displayValue(value) }}</dd></div></dl><p v-else class="muted">See the provenance manifest in the result bundle.</p></div><div><h4>Recorded policy</h4><dl v-if="Object.keys(parameters).length"><div v-for="(value, key) in parameters" :key="key"><dt>{{ key.replaceAll('_', ' ') }}</dt><dd>{{ displayValue(value) }}</dd></div></dl><p v-else class="muted">See the provenance manifest in the result bundle.</p></div></div>
  </section>
</template>
