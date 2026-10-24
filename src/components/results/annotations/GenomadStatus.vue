<script setup>
defineProps({ status: { type: String, default: "not_run" } });
</script>

<template>
  <section aria-label="geNomad virus and plasmid classification">
    <h4>Virus and plasmid classification · geNomad</h4>
    <p v-if="status === 'unavailable'">
      geNomad classification is unavailable. Permissions for hosted use and native CPU validation
      are pending. No chromosome, plasmid or virus scores or provirus boundaries were calculated by
      geNomad.
    </p>
    <p v-else>geNomad classification was not run for this result.</p>
    <p>
      Phigaro evidence is reported separately. Sequence classification does not establish infection,
      host range or active CRISPR targeting.
    </p>
  </section>
</template>
