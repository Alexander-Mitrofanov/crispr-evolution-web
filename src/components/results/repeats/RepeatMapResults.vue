<script setup>
import { computed, ref } from "vue";
const props = defineProps({
  available: Boolean,
  namespace: { type: String, default: null },
  maxDistance: { type: Number, default: null },
  topK: { type: Number, default: null },
  referenceSha256: { type: String, default: null },
  counts: { type: Object, required: true },
  results: { type: Array, required: true },
  truncated: Boolean,
  compact: Boolean,
});
const filter = ref("");
const rows = computed(() =>
  props.results.filter((r) =>
    `${r.id} ${r.sequence} ${r.status} ${r.family.values.join(" ")}`
      .toLowerCase()
      .includes(filter.value.toLowerCase()),
  ),
);
const display = (v) => v ?? "Not reported";
const stateLabel = (value) =>
  ({
    exact: "Exact reference match",
    near: "Near-match candidate",
    no_hit: "No reference hit",
    unsupported: "Unsupported input",
    historical_association: "Historical association",
    not_assessed: "Not assessed",
    predicted: "Model prediction",
    uncertain: "Uncertain model result",
    unassigned: "Unassigned",
    assigned: "Assigned reference annotation",
    ambiguous: "Ambiguous reference annotation",
  })[value] || (value ? value.replaceAll("_", " ") : "Not reported");
</script>
<template>
  <section
    class="result-section repeat-map"
    aria-label="Repeat reference mapping"
  >
    <h3>Repeat reference mapping</h3>
    <p v-if="!available">A completed repeat mapping was not reported.</p>
    <template v-else>
      <p>
        Reference: <strong>{{ display(namespace) }}</strong>
      </p>
      <p>
        {{ display(counts.exact_count) }} exact · {{ display(counts.near_count) }} near ·
        {{ display(counts.no_hit_count) }} no hit ·
        {{ display(counts.unsupported_count) }} unsupported
      </p>
      <p>
        Exact matches recover reference annotations. Near matches are candidates within
        {{ display(maxDistance) }} global edits; they do not assign a family or motif.
        Reference-relative orientation is not transcription strand. No hit does not establish
        biological novelty. Native reporting limit: {{ display(topK) }} best ties per repeat.
      </p>
      <p v-if="compact">Open Repeat matches for the sequence evidence and reference identity.</p>
      <template v-else>
        <label class="repeat-filter"
          >Filter displayed repeats
          <input
            v-model="filter"
            type="search"
        /></label>
        <p v-if="truncated">
          This preview is limited. Download the complete JSON or TSV from Files &amp; methods.
        </p>
        <p v-if="!rows.length">No displayed repeats contain that text.</p>
        <article
          v-for="row in rows"
          :key="row.id"
          class="repeat-instance"
        >
          <h4>{{ row.id }}</h4>
          <p class="repeat-outcome">{{ stateLabel(row.status) }}</p>
          <p>
            <code>{{ row.sequence }}</code>
          </p>
          <p>
            Best distance: {{ display(row.distance) }} · Best reference occurrences:
            {{ display(row.hitCount) }}
          </p>
          <p>
            Family: {{ row.family.value ?? "Unassigned" }} · {{ stateLabel(row.family.status)
            }}<span v-if="row.family.values.length"> ({{ row.family.values.join(", ") }})</span>
          </p>
          <p>
            Motif: {{ row.motif.value ?? "Unassigned" }} · {{ stateLabel(row.motif.status)
            }}<span v-if="row.motif.values.length"> ({{ row.motif.values.join(", ") }})</span>
          </p>
          <p v-if="row.truncated">
            Native reporting retained {{ display(row.reportedHitCount) }} of
            {{ display(row.hitCount) }} best ties. Annotation evidence includes every best tie.
          </p>
          <p v-if="row.previewTruncated">
            Browser preview displays {{ row.hits.length }} of
            {{ display(row.reportedHitCount) }} reported hits; complete reported evidence is in the
            downloads.
          </p>
          <details v-if="row.hits.length">
            <summary>Reference alignments</summary>
            <div
              v-for="hit in row.hits"
              :key="hit.reference_id"
            >
              <p>{{ hit.reference_id }} · {{ hit.orientation }}</p>
              <pre
                >{{ hit.query_aligned }}
{{ hit.reference_aligned }}</pre>
            </div>
          </details>
        </article>
        <details>
          <summary>Reference checksum</summary>
          <code class="sequence-text">{{ display(referenceSha256) }}</code>
        </details>
      </template>
    </template>
  </section>
</template>
