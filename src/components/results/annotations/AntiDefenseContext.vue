<script setup>
import CasContextRelations from "./CasContextRelations.vue";

defineProps({
  available: { type: Boolean, default: false },
  status: { type: String, default: "not_run" },
  counts: { type: Object, default: () => ({}) },
  systems: { type: Array, default: () => [] },
  components: { type: Array, default: () => [] },
  hits: { type: Array, default: () => [] },
  genes: { type: Array, default: () => [] },
  casContext: { type: Array, default: () => [] },
  systemsTruncated: { type: Boolean, default: false },
  componentsTruncated: { type: Boolean, default: false },
  hitsTruncated: { type: Boolean, default: false },
});
const metric = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toPrecision(4) : "Not reported";
const count = (value) => (Number.isInteger(value) && value >= 0 ? value : "Not reported");
const stateText = {
  not_run: "Anti-defense analysis was not run for this result.",
  unavailable: "Anti-defense analysis is unavailable in this runtime.",
  failed: "Anti-defense analysis failed; no biological absence can be inferred.",
};
</script>

<template>
  <section aria-label="Anti-defense candidates">
    <h3>Anti-defense and associated candidates</h3>
    <p>
      AntiDefenseFinder scans 178 profiles from model release 3.1.0 (ADF only), using HMMER and
      MacSyFinder rules. Model matches do not establish functional inhibition or inhibition of the
      submitted Cas system. Aca_alone identifies associated regulators, not an inhibitor family.
    </p>
    <p>
      Models: Institut Pasteur and CNRS; GPL-3.0 and CC BY-NC-SA 4.0 declarations retained. This
      analysis is provided for noncommercial research.
      <a
        href="https://github.com/mdmparis/defense-finder-models/tree/afb0e5a8b466be53586b13266f5d38d98c3ac268"
        target="_blank"
        rel="noopener noreferrer"
        >Model source and attribution</a
      >.
    </p>
    <p v-if="!available">{{ stateText[status] || stateText.unavailable }}</p>
    <template v-else>
      <p>
        {{ count(counts.systems) }} candidate systems · {{ count(counts.components) }} component
        assignments · {{ count(counts.hits) }} profile hits · {{ count(counts.genes) }} assessed
        proteins
      </p>
      <p v-if="counts.genes === 0">No proteins were called in the submitted sequence.</p>
      <p v-else-if="counts.systems === 0 && !systemsTruncated">
        No modeled anti-defense systems were detected in the assessed proteins. This does not
        establish absence from the complete genome.
      </p>
      <p v-if="systemsTruncated || componentsTruncated || hitsTruncated">
        This preview is limited. The protected defense-context download contains complete
        anti-defense evidence, protein sequences, source hashes and component assignments.
      </p>
      <div
        v-if="systems.length"
        class="table-wrap"
      >
        <table>
          <caption>
            Native anti-defense model calls
          </caption>
          <thead>
            <tr>
              <th>Source</th>
              <th>Family / model</th>
              <th>Interval (1-based)</th>
              <th>Completeness</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in systems"
              :key="row.id"
            >
              <td>{{ row.source_id }}</td>
              <td>{{ row.type }} / {{ row.subtype }}</td>
              <td>{{ row.start }}–{{ row.end }}</td>
              <td>{{ metric(row.wholeness) }}</td>
              <td>{{ metric(row.score) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details v-if="components.length">
        <summary>Inspect native component assignments</summary>
        <p>
          A protein can contribute to multiple model calls. Component status retains native
          semantics.
        </p>
        <ul>
          <li
            v-for="(row, i) in components"
            :key="i"
          >
            {{ row.system_id }} · {{ row.gene_id }} · {{ row.profile }} · {{ row.status }} · score
            {{ metric(row.score) }} · independent E-value {{ metric(row.i_evalue) }} · profile
            coverage {{ metric(row.profile_coverage) }}
          </li>
        </ul>
      </details>
      <details v-if="hits.length">
        <summary>Inspect HMM evidence and gathering thresholds</summary>
        <p>
          Hits outside complete system calls remain separate evidence. GA values are native profile
          thresholds.
        </p>
        <ul>
          <li
            v-for="(row, i) in hits"
            :key="i"
          >
            {{ row.gene_id }} · {{ row.profile }} · score {{ metric(row.score) }} · independent
            E-value {{ metric(row.i_evalue) }} · profile coverage
            {{ metric(row.profile_coverage) }} · amino acids {{ row.protein_start }}–{{
              row.protein_end
            }}
            · sequence/domain GA {{ metric(row.gatheringThreshold?.sequence) }} /
            {{ metric(row.gatheringThreshold?.domain) }}
          </li>
        </ul>
      </details>
      <CasContextRelations :relations="casContext" />
    </template>
  </section>
</template>

<style scoped>
section {
  display: grid;
  gap: 0.8rem;
  margin-top: 1.4rem;
}
p {
  margin: 0;
  max-width: 90ch;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.7rem;
  border-bottom: 1px solid var(--border-color, #ddd);
}
caption {
  text-align: left;
  font-weight: 600;
}
li {
  overflow-wrap: anywhere;
  margin: 0.5rem 0;
}
</style>
