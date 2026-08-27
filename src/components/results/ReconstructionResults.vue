<script setup>
import { computed } from "vue";

import { asArray, formatDuration, formatNumber, getValue } from "../../utils/formatting.js";
import AppIcon from "../common/AppIcon.vue";
import ReconstructionStory from "./ReconstructionStory.vue";

const props = defineProps({ summary: { type: Object, required: true } });
const orientation = computed(() => props.summary?.orientation || null);
const reconstruction = computed(() => props.summary?.reconstruction || props.summary?.spacerplacer || null);
const rows = computed(() => asArray(orientation.value?.selected_reconstructions).length ? asArray(orientation.value.selected_reconstructions) : asArray(reconstruction.value?.results).length ? asArray(reconstruction.value.results) : reconstruction.value?.selected_model ? [reconstruction.value.selected_model] : []);
const treePolicy = computed(() => orientation.value?.tree_policy || reconstruction.value?.tree_policy || props.summary?.pipeline?.stages?.spacerplacer?.tree_source || "not_reported");
const deletionCount = (row) => getValue(row, "nb of reconstructed deletions", "deletions", "losses", "deletion_events");
const noDeletionGroups = computed(() => rows.value.filter((row) => Number(deletionCount(row)) === 0).map((row, index) => row.name || row.group || `Group ${index + 1}`));
</script>

<template>
  <section v-if="rows.length" class="result-section reconstruction-section" aria-labelledby="reconstruction-heading">
    <div class="result-heading"><div><p class="eyebrow">SpacerPlacer ancestral reconstruction</p><h3 id="reconstruction-heading">How the spacer arrays changed</h3></div><p>Inspect rooted histories, aligned spacer states, branch events, diversity, and deletion-model evidence.</p></div>
    <div class="tree-policy"><span class="tree-glyph" aria-hidden="true"><AppIcon name="tree"/></span><div><strong>Tree policy used: {{ String(treePolicy).replaceAll('_', ' ') }}</strong><p>Decisive groups report the supported hypothesis. Unresolved groups retain input order only as a reporting default.</p></div></div>
    <div v-if="orientation?.reconstructions_truncated" class="history-truncation" role="note"><AppIcon name="warning" :size="18"/><p><strong>Some structured histories were omitted from this summary.</strong> Use result artifacts for complete detail.</p></div>
    <div class="reconstruction-story-list"><ReconstructionStory v-for="(row, index) in rows" :key="row.name || row.group || index" :row="row" :index="index" :summary="summary"/></div>
    <details class="reconstruction-values"><summary>Exact SpacerPlacer estimates and runtime</summary><div class="table-wrap reconstruction-table"><table><thead><tr><th>Group</th><th>Preferred model</th><th>BDM lnL</th><th>Insertions</th><th>Deletions</th><th>BDM deletion rate</th><th>Runtime</th></tr></thead><tbody><tr v-for="(row, index) in rows" :key="row.name || row.group || index"><td><strong>{{ row.name || row.group || `Group ${index + 1}` }}</strong></td><td>{{ getValue(row, 'Deletion model preferred by LRT', 'preferred_model', 'model_name', 'model') || '—' }}</td><td>{{ formatNumber(getValue(row, 'ln_lh_bdm', 'log_likelihood', 'ln_likelihood', 'lnL'), 3) }}</td><td>{{ formatNumber(getValue(row, 'nb of reconstructed insertions', 'gains', 'insertions')) }}</td><td>{{ formatNumber(deletionCount(row)) }}</td><td>{{ formatNumber(getValue(row, 'deletion_rate_bdm', 'deletion_rate', 'loss_rate'), 4) }}</td><td>{{ formatDuration(getValue(row, 'run_time', 'runtime_seconds', 'duration_seconds')) }}</td></tr></tbody></table></div></details>
    <div v-if="noDeletionGroups.length" class="warning-note"><AppIcon name="warning"/><p><strong>No deletion events were reconstructed for {{ noDeletionGroups.join(', ') }}.</strong> Deletion-rate estimates and orientation evidence may not be meaningful for those groups.</p></div>
  </section>
</template>
