<script setup>
defineProps({ assets: { type: Object, default: null } });
const publicBase = import.meta.env.BASE_URL;
</script>
<template>
  <section
    class="example-downloads"
    aria-label="Example downloads"
  >
    <h3>Example files</h3>
    <p v-if="assets">
      <a
        :href="`${publicBase}${assets.input}`"
        download
        >Download example input</a
      >
      ·
      <a
        :href="`${publicBase}${assets.result}`"
        download
        >Download precomputed output</a
      >
    </p>
    <p>
      The precomputed output contains the published result and recorded provenance. Individual
      worker artifacts and a live-job archive are not included in this example; this is an export
      limitation, not a failed download.
    </p>
  </section>
</template>
