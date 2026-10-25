<script setup>
import { computed, nextTick, ref, shallowRef, useId, watch } from "vue";
import { catalogCell, catalogEvidence } from "../../features/catalog/index.js";

const props = defineProps({
  rows: { type: Array, required: true },
  columns: { type: Array, required: true },
  label: { type: String, required: true },
});
defineEmits(["array", "genome"]);
const selectedEvidence = ref(null);
const evidencePanel = ref(null);
const evidenceTrigger = shallowRef(null);
const panelId = useId();
const selectedIdentity = computed(
  () =>
    selectedEvidence.value?.row.call_id ||
    selectedEvidence.value?.row.id ||
    selectedEvidence.value?.row.accession,
);
watch(
  () => props.rows,
  () => {
    selectedEvidence.value = null;
  },
);
async function openEvidence(row, key, event) {
  selectedEvidence.value = { row, key };
  evidenceTrigger.value = event.currentTarget;
  await nextTick();
  evidencePanel.value?.focus({ preventScroll: true });
  evidencePanel.value?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}
function closeEvidence() {
  selectedEvidence.value = null;
  evidenceTrigger.value?.focus();
}
</script>

<template>
  <div class="catalog-table-container">
    <p class="table-scroll-hint">
      Each record includes its complete identity and evidence. On wide tables, scroll sideways for
      all columns.
    </p>
    <div
      class="catalog-table-scroll"
      role="region"
      :aria-label="label"
      tabindex="0"
    >
      <table class="catalog-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column[0]"
              scope="col"
            >
              {{ column[1] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id ?? row.accession"
          >
            <td
              v-for="[key, columnLabel, kind] in columns"
              :key="key"
              :data-label="columnLabel"
            >
              <button
                v-if="kind === 'array'"
                class="catalog-record-link"
                type="button"
                :aria-label="`Open array ${row.call_id || row.array_id}`"
                @click="$emit('array', row.array_id ?? row.id)"
              >
                {{ catalogCell(row, key) }}
              </button>
              <button
                v-else-if="kind === 'genome'"
                class="catalog-record-link"
                type="button"
                :aria-label="`Browse genome ${row.accession}`"
                @click="$emit('genome', row.accession)"
              >
                {{ catalogCell(row, key) }}
              </button>
              <button
                v-else-if="kind === 'evidence'"
                type="button"
                class="catalog-record-link"
                :aria-label="`Evidence for ${row.call_id}`"
                :aria-controls="panelId"
                :aria-expanded="selectedEvidence?.row === row"
                @click="openEvidence(row, key, $event)"
              >
                View evidence
              </button>
              <code
                v-else-if="kind === 'sequence'"
                class="catalog-sequence"
                >{{ catalogCell(row, key) }}</code
              >
              <span v-else>{{ catalogCell(row, key) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <section
      v-if="selectedEvidence"
      :id="panelId"
      ref="evidencePanel"
      class="catalog-evidence-panel"
      tabindex="-1"
      :aria-label="`Evidence for ${selectedIdentity}`"
    >
      <div class="catalog-evidence-heading">
        <h4>Evidence for {{ selectedIdentity }}</h4>
        <button
          type="button"
          @click="closeEvidence"
        >
          Close evidence
        </button>
      </div>
      <dl>
        <div
          v-for="field in catalogEvidence(selectedEvidence.row, selectedEvidence.key)"
          :key="field.label"
        >
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
