<script setup>
import AppIcon from "../common/AppIcon.vue";

const citations = [
  {
    tool: "CRISPRidentify",
    venue: "Nucleic Acids Research · 2021",
    title: "Identification of CRISPR arrays using a machine-learning approach",
    doi: "https://doi.org/10.1093/nar/gkaa1158",
    source: "https://github.com/BackofenLab/CRISPRidentify",
  },
  {
    tool: "SpacerPlacer",
    venue: "Nucleic Acids Research · 2024",
    title: "Ancestral reconstruction of CRISPR arrays reveals spacer-deletion dynamics",
    doi: "https://doi.org/10.1093/nar/gkae772",
    source: "https://github.com/fbaumdicker/SpacerPlacer",
  },
  {
    tool: "CRISPR-evOr",
    venue: "PLOS Computational Biology · 2025",
    title: "An evolutionary approach to predict the orientation of CRISPR arrays",
    doi: "https://doi.org/10.1371/journal.pcbi.1013706",
    source: "https://github.com/fbaumdicker/SpacerPlacer",
  },
];
</script>

<template>
  <section
    id="references"
    class="references"
    aria-labelledby="references-heading"
  >
    <div class="references-heading">
      <div><h2 id="references-heading">Primary references</h2></div>
      <p>Use the archived bundle for run-specific versions and parameters.</p>
    </div>
    <div class="reference-grid">
      <article
        v-for="item in citations"
        :key="item.tool"
      >
        <span>{{ item.venue }}</span>
        <h3>{{ item.tool }}</h3>
        <p>{{ item.title }}</p>
        <div>
          <a
            :href="item.doi"
            target="_blank"
            rel="noopener noreferrer"
            >Publication
            <AppIcon
              name="external"
              :size="15" /></a
          ><a
            :href="item.source"
            target="_blank"
            rel="noopener noreferrer"
            >Source
            <AppIcon
              name="external"
              :size="15"
          /></a>
        </div>
      </article>
    </div>
  </section>
</template>
