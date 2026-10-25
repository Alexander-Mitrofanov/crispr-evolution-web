<script setup>
import AppIcon from "../../common/AppIcon.vue";
defineProps({
  title: { type: String, required: true },
  example: Boolean,
  filename: { type: String, default: "" },
  recordCount: { type: Number, default: null },
});
</script>
<template>
  <div class="results-title">
    <div>
      <h2
        id="results-heading"
        tabindex="-1"
      >
        {{ title }} results
      </h2>
      <p class="results-context">
        {{ example ? "Precomputed example" : "Completed analysis"
        }}<template v-if="filename"> · {{ filename }}</template
        ><template v-if="recordCount != null">
          · {{ recordCount }} input {{ recordCount === 1 ? "record" : "records" }}</template
        >
      </p>
    </div>
    <span class="complete-stamp"><AppIcon name="check" /> Completed</span>
  </div>
</template>
