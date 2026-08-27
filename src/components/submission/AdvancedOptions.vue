<script setup>
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({ mode: { type: String, required: true }, modelValue: { type: Object, required: true } });
const emit = defineEmits(["update:modelValue"]);
const update = (values) => emit("update:modelValue", { ...props.modelValue, ...values });
</script>

<template>
  <details class="advanced">
    <summary><span>Advanced analysis policy</span><small>Transparent, bounded settings</small></summary>
    <div class="advanced-body">
      <fieldset><legend>Eligible CRISPRidentify categories</legend><label class="radio-line"><input type="radio" name="category-policy" value="bona_fide_possible" :checked="modelValue.categoryPolicy === 'bona_fide_possible'" @change="update({ categoryPolicy: 'bona_fide_possible' })"><span><strong>Bona-fide + Possible</strong><small>Default · preserves plausible arrays for group preflight</small></span></label><label class="radio-line"><input type="radio" name="category-policy" value="bona_fide_only" :checked="modelValue.categoryPolicy === 'bona_fide_only'" @change="update({ categoryPolicy: 'bona_fide_only' })"><span><strong>Strict Bona-fide only</strong><small>Higher specificity, but may leave fewer comparable arrays</small></span></label></fieldset>
      <div v-if="mode !== 'detection'" class="option-column"><label for="edit-distance"><strong>Spacer edit distance</strong><small>Maximum sequence edits when matching homologous spacers</small></label><div class="number-control"><button type="button" aria-label="Decrease spacer edit distance" @click="update({ spacerEditDistance: Math.max(0, modelValue.spacerEditDistance - 1) })"><AppIcon name="minus" :size="16"/></button><output id="edit-distance" aria-live="polite">{{ modelValue.spacerEditDistance }}</output><button type="button" aria-label="Increase spacer edit distance" @click="update({ spacerEditDistance: Math.min(2, modelValue.spacerEditDistance + 1) })"><AppIcon name="plus" :size="16"/></button></div></div>
      <div v-if="mode !== 'detection'" class="option-column"><span><strong>Deletion-parameter bias corrections</strong><small>Refine α/ρ deletion-parameter estimates; orientation ΔlnL is unchanged. On this public service, if a group/direction-specific ρ correction has no finite fit, that fit alone uses uncorrected ρ estimates and records a warning instead of failing the job. The affected deletion-rate estimates and IDM/BDM LRT remain uncorrected; strict all-corrections-or-error is a separate CLI policy.</small></span><div class="segmented" role="group" aria-label="Deletion-parameter bias corrections"><button type="button" :aria-pressed="modelValue.biasCorrection" @click="update({ biasCorrection: true })">Enabled</button><button type="button" :aria-pressed="!modelValue.biasCorrection" @click="update({ biasCorrection: false })">Disabled</button></div></div>
      <div class="policy-note"><strong>{{ mode === 'detection' ? 'Detection only' : 'Tree policy' }}</strong><span>{{ mode === 'detection' ? 'Spacer matching, tree estimation, and evolutionary modeling are not run.' : 'Trees are estimated separately for input and reversed order. The result reports the exact policy used.' }}</span></div>
    </div>
  </details>
</template>
