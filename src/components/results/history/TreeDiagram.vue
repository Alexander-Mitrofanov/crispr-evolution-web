<script setup>
import { computed, ref, watch } from "vue";

import { layoutNewick } from "../../../utils/newick.js";

const props = defineProps({
  newick: { type: String, default: "" },
  group: { type: String, default: "group" },
  selectedNode: { type: String, default: "" },
  reportedByDefault: Boolean,
  statusLabel: { type: String, default: "" },
});
const emit = defineEmits(["select-node"]);
const inspectedNode = ref(null);
watch(
  () => props.newick,
  () => {
    inspectedNode.value = null;
  },
);
function inspectNode(node) {
  inspectedNode.value = node;
  emit("select-node", node.name);
}
const isSelected = (node) =>
  inspectedNode.value
    ? node.id === inspectedNode.value.id
    : Boolean(props.selectedNode) && String(node.name) === props.selectedNode;
const provisional = computed(() => layoutNewick(props.newick, 100));
const height = computed(() => Math.max(190, (provisional.value?.leaves.length || 1) * 58 + 58));
const layout = computed(() => layoutNewick(props.newick, height.value));
const internalEdges = computed(
  () => layout.value?.nodes.filter((node) => node.children.length) || [],
);
const displayLabel = computed(
  () =>
    props.statusLabel ||
    (props.reportedByDefault
      ? "Reported input-order model tree"
      : "Displayed hypothesis model tree"),
);
</script>

<template>
  <div
    v-if="layout"
    class="tree-graphic"
  >
    <div class="graphic-label">
      <span>{{ displayLabel }}</span
      ><small>Branch lengths scaled when available</small>
    </div>
    <p
      v-if="inspectedNode"
      class="tree-node-inspector"
      role="status"
    >
      <strong>Selected {{ inspectedNode.children.length ? "internal node" : "leaf" }}:</strong>
      {{ inspectedNode.name || `node ${inspectedNode.id}` }}<br />Branch length:
      {{ inspectedNode.lengthReported ? inspectedNode.length : "Not reported" }}. Full identity is
      shown; ancestral spacer data is unavailable in this tree-only view.
    </p>
    <svg
      :viewBox="`0 0 720 ${height}`"
      role="img"
      :aria-label="`${displayLabel} for ${group} with ${layout.leaves.length} leaves`"
    >
      <desc>Rooted model tree for {{ group }}. Exact Newick: {{ newick }}</desc>
      <g
        v-for="node in internalEdges"
        :key="`edges-${node.id}`"
      >
        <line
          :x1="node.x"
          :x2="node.x"
          :y1="Math.min(...node.children.map((child) => child.y))"
          :y2="Math.max(...node.children.map((child) => child.y))"
          class="tree-line"
        />
        <line
          v-for="child in node.children"
          :key="`edge-${child.id}`"
          :x1="node.x"
          :x2="child.x"
          :y1="child.y"
          :y2="child.y"
          class="tree-line"
        />
      </g>
      <g
        v-for="node in layout.nodes"
        :key="`node-${node.id}`"
        class="history-node-target"
        role="button"
        tabindex="0"
        :aria-label="`Inspect node ${node.name || `node ${node.id}`}`"
        @click="inspectNode(node)"
        @keydown.enter.prevent="inspectNode(node)"
        @keydown.space.prevent="inspectNode(node)"
      >
        <title>{{ node.name || `node ${node.id}` }}</title>
        <circle
          :cx="node.x"
          :cy="node.y"
          :r="isSelected(node) ? 7 : node.children.length ? 4 : 5"
          :class="[
            node.children.length ? 'tree-node' : 'tree-leaf-node',
            { selected: isSelected(node) },
          ]"
        />
        <text
          v-if="!node.children.length"
          :x="node.x + 11"
          :y="node.y + 4"
          class="tree-leaf-label"
        >
          {{ node.name.length > 30 ? `${node.name.slice(0, 28)}…` : node.name }}
        </text>
      </g>
    </svg>
  </div>
</template>
