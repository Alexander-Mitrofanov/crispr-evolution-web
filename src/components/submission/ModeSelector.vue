<script setup>
import { ANALYSIS_MODES } from "../../science.js";

const emit = defineEmits(["select", "database"]);

function openDatabase(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    return;
  event.preventDefault();
  emit("database");
}

function choose(event, id) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    return;
  event.preventDefault();
  emit("select", id);
}
</script>

<template>
  <section
    class="method-picker"
    aria-labelledby="methods-heading"
  >
    <h1
      id="methods-heading"
      tabindex="-1"
    >
      Choose a method
    </h1>
    <div class="method-grid">
      <a
        class="method-link database-entry"
        href="?view=database"
        aria-label="Search the database"
        aria-describedby="database-entry-description"
        @click="openDatabase"
      >
        <strong>Search the database</strong>
        <span id="database-entry-description">Genomes, repeats, spacers &amp; Cas genes</span>
      </a>
      <a
        v-for="item in ANALYSIS_MODES"
        :key="item.id"
        class="method-link"
        :href="`?method=${item.id}`"
        :aria-label="item.title"
        :aria-describedby="`method-${item.id}-description`"
        @click="choose($event, item.id)"
      >
        <strong>{{ item.title }}</strong>
        <span :id="`method-${item.id}-description`">{{ item.short }}</span>
      </a>
    </div>
  </section>
</template>
