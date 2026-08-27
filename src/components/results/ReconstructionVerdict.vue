<script setup>
import { computed } from "vue";

import { formatNumber } from "../../utils/formatting.js";
import { reconstructionMetric } from "../../utils/reconstruction.js";

const props = defineProps({ row: { type: Object, required: true } });
const acquisitions = computed(() => reconstructionMetric(props.row, "acquisitions"));
const deletions = computed(() => reconstructionMetric(props.row, "deletions"));
const leaves = computed(() => reconstructionMetric(props.row, "leaves"));
const patterns = computed(() => reconstructionMetric(props.row, "patterns"));
const unique = computed(() => reconstructionMetric(props.row, "unique"));
</script>

<template>
  <div class="spacerplacer-verdict">
    <div><small>Evolutionary reconstruction at a glance</small><strong>{{ formatNumber(acquisitions) }} acquisitions · {{ formatNumber(deletions) }} deletions</strong><p>SpacerPlacer placed ancestral events across {{ formatNumber(leaves) }} related arrays. An acquisition includes a spacer’s inferred first entry into the history; these are model estimates, not newly observed mutations.</p></div>
    <div class="verdict-metrics"><span><b>{{ formatNumber(unique) }}</b><small>unique spacers</small></span><span><b>{{ formatNumber(patterns) }}</b><small>distinct array patterns</small></span><span><b>{{ formatNumber(leaves) }}</b><small>modeled leaves</small></span></div>
  </div>
</template>
