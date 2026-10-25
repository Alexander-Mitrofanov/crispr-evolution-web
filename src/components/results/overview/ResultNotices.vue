<script setup>
import { computed } from "vue";
import AppIcon from "../../common/AppIcon.vue";
const props = defineProps({ warnings: { type: Array, default: () => [] }, noEligible: Boolean });
const artifactWarnings = computed(() =>
  props.warnings.filter((warning) =>
    /^Public artifact omitted because/.test(warning.message || String(warning)),
  ),
);
const scientificWarnings = computed(() =>
  props.warnings.filter((warning) => !artifactWarnings.value.includes(warning)),
);
</script>
<template>
  <div
    v-if="noEligible"
    class="no-eligible"
    role="status"
  >
    <AppIcon name="info" />
    <div>
      <strong>No eligible evolutionary groups</strong>
      <p>
        Detection completed. No group met the selected filters; evolution and orientation were not
        evaluated.
      </p>
    </div>
  </div>
  <ul
    v-if="scientificWarnings.length"
    class="warning-list"
    aria-label="Analysis warnings"
  >
    <li
      v-for="(warning, index) in scientificWarnings"
      :key="index"
    >
      <AppIcon
        name="warning"
        :size="18"
      />
      <span
        ><strong>{{ warning.title || warning.code || "Analysis warning" }}</strong
        >{{ warning.message || String(warning) }}</span
      >
    </li>
  </ul>
  <details
    v-if="artifactWarnings.length"
    class="artifact-warning-summary"
  >
    <summary>
      <strong
        >{{ artifactWarnings.length }} downloadable
        {{ artifactWarnings.length === 1 ? "artifact" : "artifacts" }} omitted</strong
      >
      · Analysis completed; some exported evidence is unavailable.
    </summary>
    <p>
      These artifacts were invalid or contained private paths and could not be published. Retained
      result previews are shown below; omitted files cannot be inspected or downloaded.
    </p>
    <ul>
      <li
        v-for="(warning, index) in artifactWarnings"
        :key="index"
      >
        {{ warning.message || String(warning) }}
      </li>
    </ul>
  </details>
</template>
