<script setup>
const publicBase = import.meta.env.BASE_URL;
</script>

<template>
  <a
    class="brand"
    href="#top"
    aria-label="CRISPRloci v2 home"
  >
    <img
      class="brand-symbol"
      :src="`${publicBase}brand/logo-on-dark.svg?v=4`"
      width="40"
      height="40"
      alt=""
      aria-hidden="true"
    />
    <span class="brand-copy"><strong>CRISPRloci</strong><small>v2</small></span>
  </a>
</template>
