<script setup>
import { computed } from "vue";
import { ANALYSIS_MODES, analysisModeAvailable } from "../../science.js";
import { exampleAssetsFor } from "../../example.js";

const props = defineProps({ service: { type: Object, default: () => ({}) } });
const modes = computed(() =>
  ANALYSIS_MODES.filter(
    (item) =>
      !["protospacer", "viral_search"].includes(item.id) &&
      (analysisModeAvailable(item.id, props.service) || exampleAssetsFor(item.id)),
  ),
);

const spacerMode = computed(() =>
  ["protospacer", "viral_search"].find(
    (mode) => analysisModeAvailable(mode, props.service) || exampleAssetsFor(mode),
  ),
);

const groups = computed(() =>
  [
    {
      title: "Genomes and loci",
      ids: [
        "loci",
        "detection",
        "cas",
        "tracrrna",
        "leader",
        "locus_compare",
        "prophage_context",
        "insertion_context",
        "defense_context",
      ],
    },
    {
      title: "Repeats and RNA",
      ids: ["repeats", "repeat_context", "repeat_type", "repeat_map", "rna_family"],
    },
    { title: "Spacers and references", ids: ["spacer_association"], spacer: true, database: true },
    { title: "Arrays and evolution", ids: ["array_compare", "reconstruction", "orientation"] },
  ].map((group) => ({
    ...group,
    modes: group.ids.map((id) => modes.value.find((mode) => mode.id === id)).filter(Boolean),
  })),
);

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
    <section
      v-for="group in groups"
      :key="group.title"
      class="method-group"
    >
      <h2>{{ group.title }}</h2>
      <div class="method-grid">
        <a
          v-if="group.database"
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
          v-if="group.spacer && spacerMode"
          aria-label="Spacer searches"
          class="method-link"
          :href="`?method=${spacerMode}`"
          @click="choose($event, spacerMode)"
          ><strong>Spacer searches</strong
          ><span>Find spacers in DNA or candidate viruses for your spacers</span></a
        >
        <a
          v-for="item in group.modes"
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
  </section>
</template>
