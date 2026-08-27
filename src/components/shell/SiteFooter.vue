<script setup>
import { computed } from "vue";

import { api } from "../../api.js";
import BrandMark from "../common/BrandMark.vue";

defineProps({ service: { type: Object, required: true } });

const hostname = computed(() => {
  try { return api.displayBase ? new URL(api.displayBase).hostname : "not configured"; }
  catch { return "invalid endpoint"; }
});
</script>

<template>
  <footer><div><BrandMark/><p>Research software for transparent CRISPR array detection and evolutionary reconstruction.</p></div><div><strong>Analysis service</strong><span>{{ hostname }}</span><small>{{ service.version ? `API ${service.version}` : 'Operator-provided endpoint' }}</small></div><div><strong>Data handling</strong><span>Token-protected jobs</span><small>Automatic expiry · no token in URLs</small></div></footer>
</template>
