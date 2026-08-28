<script setup>
import { computed } from "vue";

import { categoryClass } from "../../../science.js";
import { formatNumber } from "../../../utils/formatting.js";
import AppIcon from "../../common/AppIcon.vue";

const props = defineProps({
  summary: { type: Object, required: true },
  arrays: { type: Array, default: () => [] },
});
const categories = computed(() => {
  const reported = props.summary.category_counts;
  if (Object.keys(reported).length) return reported;
  return props.arrays.reduce((counts, row) => {
    const label = row.category || "Unclassified";
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
});
const ordered = computed(() =>
  [
    ...new Set([
      "Bona-fide",
      "Possible",
      "Possible discarded",
      "Low score",
      ...Object.keys(categories.value),
    ]),
  ].filter((key) => categories.value[key] != null),
);
</script>

<template>
  <section
    class="result-section category-section"
    aria-labelledby="category-heading"
  >
    <div class="result-heading">
      <div>
        <p class="eyebrow">Primary detection result</p>
        <h3 id="category-heading">CRISPRidentify categories</h3>
      </div>
      <p>Categories express detector policy; they are not evolutionary conclusions.</p>
    </div>
    <div
      v-if="ordered.length"
      class="category-grid"
    >
      <div
        v-for="label in ordered"
        :key="label"
        :class="['category-card', `category-${categoryClass(label)}`]"
      >
        <span>{{ label }}</span
        ><strong>{{ formatNumber(categories[label]) }}</strong
        ><small>arrays</small>
      </div>
    </div>
    <div
      v-else
      class="empty-result"
    >
      No CRISPR array calls were reported.
    </div>
    <div
      v-if="arrays.length"
      class="table-wrap"
      role="region"
      tabindex="0"
      aria-label="Scrollable CRISPRidentify array results"
    >
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Coordinates</th>
            <th>Category</th>
            <th>Strand</th>
            <th>Spacers</th>
            <th>Raw CRISPRidentify Model score</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in arrays"
            :key="`${row.source_id}:${row.array_id}:${index}`"
          >
            <td>
              <strong>{{ row.source_id || "—" }}</strong
              ><small>{{ row.array_id || "" }}</small>
            </td>
            <td>
              {{
                row.start != null && row.end != null
                  ? `${formatNumber(row.start)}–${formatNumber(row.end)}`
                  : "—"
              }}
            </td>
            <td>
              <span :class="['category-pill', `category-${categoryClass(row.category)}`]">{{
                row.category || "Unclassified"
              }}</span>
            </td>
            <td>{{ row.strand || "Unknown" }}</td>
            <td>{{ formatNumber(row.spacer_count) }}</td>
            <td>
              <span class="raw-score">{{ formatNumber(row.model_score, 4) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="interpretation-note">
      <AppIcon
        name="info"
        :size="18"
      />
      <p>
        <strong>About the raw Model score:</strong> it is
        <strong>not a calibrated probability</strong>, is never shown as a percentage, and must be
        interpreted with the category and array context.
      </p>
    </div>
  </section>
</template>
