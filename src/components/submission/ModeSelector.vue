<script setup>
import { ANALYSIS_MODES } from "../../science.js";
import AppIcon from "../common/AppIcon.vue";

defineProps({ modelValue: { type: String, required: true } });
defineEmits(["update:modelValue"]);
</script>

<template>
  <section
    class="mode-section"
    aria-labelledby="analysis-goal-heading"
  >
    <h3
      id="analysis-goal-heading"
      class="section-title"
    >
      <span><b>1</b> Choose the analysis goal</span
      ><small>The workflow only runs the tools needed for your question.</small>
    </h3>
    <fieldset class="mode-fieldset">
      <legend class="sr-only">Choose the analysis goal</legend>
      <div class="mode-grid">
        <label
          v-for="item in ANALYSIS_MODES"
          :key="item.id"
          :class="['mode-card', { selected: modelValue === item.id }]"
        >
          <input
            type="radio"
            name="mode"
            :value="item.id"
            :checked="modelValue === item.id"
            @change="$emit('update:modelValue', item.id)"
          />
          <span class="mode-top"
            ><b>{{ item.number }}</b
            ><small v-if="item.badge">{{ item.badge }}</small
            ><i aria-hidden="true"
              ><AppIcon
                name="check"
                :size="16" /></i
          ></span>
          <strong>{{ item.title }}</strong
          ><span class="mode-tool">{{ item.short }}</span>
          <p>{{ item.description }}</p>
          <span class="tool-chain">{{ item.tools.join("  →  ") }}</span>
        </label>
      </div>
    </fieldset>
  </section>
</template>
