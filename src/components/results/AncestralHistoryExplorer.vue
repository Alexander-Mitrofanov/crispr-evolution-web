<script setup>
import { computed, ref, watch } from "vue";

import { asArray, finiteMetric, formatNumber, getValue } from "../../utils/formatting.js";
import { parseNewick } from "../../utils/newick.js";
import { comparisonDecisionFor, groupIdentity } from "../../utils/results.js";
import AppIcon from "../common/AppIcon.vue";
import TreeDiagram from "./TreeDiagram.vue";

const props = defineProps({ summary: { type: Object, required: true }, group: { type: String, required: true }, fallbackTree: { type: String, default: "" }, reportedByDefault: Boolean });
const orientation = computed(() => props.summary?.orientation || {});
const reconstructions = computed(() => asArray(orientation.value.reconstructions).filter((entry) => String(entry?.group || entry?.name) === props.group && ["input", "reverse"].includes(entry?.hypothesis)));
const comparison = computed(() => asArray(orientation.value.comparisons).find((item, index) => groupIdentity(item, index) === props.group));
const decision = computed(() => comparison.value ? comparisonDecisionFor(comparison.value, orientation.value).label : "Unresolved");
const requiredHypothesis = computed(() => decision.value === "Input order supported" ? "input" : decision.value === "Reverse input order supported" ? "reverse" : "input");
const hypothesis = ref("input");
const selectedNodeName = ref("");
watch(reconstructions, (rows) => { hypothesis.value = rows.some((row) => row.hypothesis === requiredHypothesis.value) ? requiredHypothesis.value : rows[0]?.hypothesis || "input"; selectedNodeName.value = ""; }, { immediate: true });
const entry = computed(() => reconstructions.value.find((item) => item.hypothesis === hypothesis.value) || reconstructions.value[0]);
const parsedTree = computed(() => parseNewick(entry.value?.newick));
const nodeData = computed(() => asArray(entry.value?.nodes));
const selectedNode = computed(() => nodeData.value.find((node) => String(node?.name) === selectedNodeName.value) || nodeData.value.find((node) => String(node?.name) === String(parsedTree.value?.name)) || nodeData.value[0]);
const spacerOrder = computed(() => asArray(entry.value?.spacer_order).map(Number).filter((value) => Number.isInteger(value) && value > 0).slice(0, 100));
const selectedSpacers = computed(() => new Set(asArray(selectedNode.value?.spacers).map(Number)));
const losses = computed(() => asArray(selectedNode.value?.loss_blocks).flat(4));
const likelihood = (kind) => finiteMetric(getValue(comparison.value, kind === "input" ? "forward_ln_likelihood_bdm" : "reverse_ln_likelihood_bdm"));
const chooseNode = (name) => { selectedNodeName.value = String(name || ""); };
</script>

<template>
  <div v-if="reconstructions.length" class="history-explorer">
    <div class="history-toolbar"><div><strong>Ancestral history explorer</strong><small>Compare hypotheses and inspect reconstructed nodes</small></div><div class="history-hypothesis-switch" role="group" aria-label="Spacer-order hypothesis"><button v-for="kind in ['input', 'reverse']" :key="kind" type="button" :aria-pressed="hypothesis === kind" :disabled="!reconstructions.some((item) => item.hypothesis === kind)" @click="hypothesis = kind"><span>{{ kind === 'input' ? 'Input spacer order' : 'Reversed spacer order' }}</span><strong>{{ formatNumber(likelihood(kind), 3) }} lnL</strong></button></div></div>
    <div class="history-summary"><span><small>Interpretation</small><strong>{{ decision }}</strong></span><span><small>Acquisitions</small><strong>{{ formatNumber(entry?.acquisition_count) }}</strong></span><span><small>Deletions</small><strong>{{ formatNumber(entry?.deletion_count) }}</strong></span><span><small>Hypothesis shown</small><strong>{{ hypothesis }}</strong></span></div>
    <TreeDiagram :newick="entry?.newick" :group="group" :selected-node="String(selectedNode?.name || '')" :reported-by-default="reportedByDefault && hypothesis === 'input'" @select-node="chooseNode"/>
    <div v-if="selectedNode" class="history-inspector"><div><p class="eyebrow">Selected reconstructed node</p><h5>{{ selectedNode.name || 'Unnamed node' }}</h5><p>{{ selectedSpacers.size }} retained spacers · {{ asArray(selectedNode.gains).length }} gains · {{ losses.length }} losses</p></div><dl><div><dt>Gains</dt><dd>{{ asArray(selectedNode.gains).length ? asArray(selectedNode.gains).join(', ') : '—' }}</dd></div><div><dt>Loss blocks</dt><dd>{{ asArray(selectedNode.loss_blocks).length ? asArray(selectedNode.loss_blocks).map((block) => `[${asArray(block).join(', ')}]`).join(' ') : '—' }}</dd></div><div><dt>Special events</dt><dd>{{ ['duplications', 'rearrangements', 'reacquisitions', 'independent_gains'].map((key) => asArray(selectedNode[key]).length).reduce((sum, value) => sum + value, 0) || '—' }}</dd></div></dl></div>
    <div class="history-array" role="img" :aria-label="`Spacer state for selected node ${selectedNode?.name || ''}`"><span v-for="spacer in spacerOrder" :key="spacer" :class="['history-spacer', `history-color-${Math.abs(spacer) % 12}`, { absent: !selectedSpacers.has(spacer) }]" :title="`Spacer ${spacer}`">{{ spacer }}</span></div>
    <p v-if="asArray(entry?.spacer_order).length > spacerOrder.length" class="history-truncation"><AppIcon name="info" :size="16"/> Inline display is capped at {{ spacerOrder.length }} spacer columns; downloadable artifacts retain the complete history.</p>
  </div>
  <TreeDiagram v-else-if="fallbackTree" :newick="fallbackTree" :group="group" :reported-by-default="reportedByDefault"/>
</template>
