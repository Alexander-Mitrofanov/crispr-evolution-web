<script setup>
import { useAnalysisForm } from "../../features/submission/index.js";
import AppIcon from "../common/AppIcon.vue";
import AdvancedOptions from "./AdvancedOptions.vue";
import FastaInput from "./FastaInput.vue";
import { ANALYSIS_MODES } from "../../science.js";
import SpacerSearchControls from "./SpacerSearchControls.vue";
import ReadinessPanel from "./ReadinessPanel.vue";

const props = defineProps({
  service: { type: Object, required: true },
  limits: { type: Object, required: true },
  hasActiveJob: Boolean,
  initialMode: {
    type: String,
    default: "loci",
    validator: (value) => ANALYSIS_MODES.some((item) => item.id === value),
  },
});
const emit = defineEmits(["submitted", "example-loaded", "back", "change-mode"]);
const {
  mode,
  molecule,
  inputLimits,
  sequence,
  filename,
  options,
  submitting,
  loadingExample,
  error,
  inspection,
  selectedMode,
  requestBytes,
  precomputedPolicyMatches,
  ready,
  loadExample,
  submit,
} = useAnalysisForm(props, emit);
</script>

<template>
  <section
    id="workflow"
    class="workflow"
    aria-labelledby="workflow-title"
  >
    <button
      class="back-to-methods"
      type="button"
      @click="$emit('back')"
    >
      All methods
    </button>
    <div class="section-intro">
      <h1
        id="workflow-title"
        tabindex="-1"
      >
        {{
          ["protospacer", "viral_search"].includes(mode) ? "Spacer searches" : selectedMode.title
        }}
      </h1>
      <p
        v-if="!['protospacer', 'viral_search'].includes(mode)"
        class="method-description"
      >
        {{ selectedMode.description }}
      </p>
    </div>
    <SpacerSearchControls
      v-if="['protospacer', 'viral_search'].includes(mode)"
      :mode="mode"
      v-model:mismatches="options.viralMaxMismatches"
      :service="service"
      @direction="emit('change-mode', $event)"
    />
    <form
      id="analysis-form"
      novalidate
      @submit.prevent="submit"
    >
      <section
        class="input-section"
        aria-labelledby="input-step-heading"
      >
        <h3
          id="input-step-heading"
          class="section-title"
        >
          Sequences
        </h3>
        <fieldset
          v-if="mode === 'repeats'"
          class="repeat-molecule"
        >
          <legend>Input molecule</legend>
          <label
            ><input
              v-model="options.molecule"
              type="radio"
              value="DNA"
              name="repeat-molecule"
            />
            DNA repeats — both orientation hypotheses</label
          >
          <label
            ><input
              v-model="options.molecule"
              type="radio"
              value="RNA"
              name="repeat-molecule"
            />
            RNA repeats — transcribed 5′→3′ sequence</label
          >
          <p>
            Up to 1,000 repeats, 200 nt per record, within the service limits. Use T for DNA and U
            for RNA; mixed T/U input is rejected.
          </p>
        </fieldset>
        <div class="input-layout">
          <FastaInput
            v-model:sequence="sequence"
            v-model:filename="filename"
            :inspection="inspection"
            :repeat-input="['repeats', 'repeat_map'].includes(mode)"
            :spacer-input="mode === 'viral_search'"
            :molecule="molecule"
            :loading-example="loadingExample"
            :show-example="mode === 'orientation'"
            :example-disabled="hasActiveJob"
            :max-request-bytes="limits.maxRequestBytes"
            @load-example="loadExample"
          /><ReadinessPanel
            :inspection="inspection"
            :selected-mode="selectedMode"
            :limits="inputLimits"
            :molecule="molecule"
            :service="service"
            :request-bytes="requestBytes"
          />
        </div>
      </section>
      <section
        v-if="!['repeat_map', 'repeats', 'protospacer', 'viral_search'].includes(mode)"
        class="policy-section"
        aria-labelledby="policy-step-heading"
      >
        <h3
          id="policy-step-heading"
          class="sr-only"
        >
          Options
        </h3>
        <AdvancedOptions
          v-model="options"
          :mode="mode"
        />
      </section>
      <div
        v-if="error"
        class="submit-error"
        role="alert"
      >
        <AppIcon name="warning" /><span>{{ error }}</span>
      </div>
      <div
        v-if="hasActiveJob"
        class="active-job-lock"
        role="status"
      >
        <AppIcon name="info" /><span
          ><strong>Another job is open.</strong> Copy its recovery link, then cancel it or leave it
          after completion.</span
        >
      </div>
      <div
        class="privacy-notice"
        role="note"
        aria-label="Sequence privacy and retention notice"
      >
        <AppIcon name="shield" />
        <p>
          <strong>Non-sensitive research data only.</strong> Sequences are sent to the service
          operator. Results are deleted
          {{
            service.expiresHours
              ? `${service.expiresHours} hours after the run finishes`
              : "under the configured retention policy"
          }}.
        </p>
        <details class="privacy-details">
          <summary>Data privacy</summary>
          <p>
            The job token protects retrieval; it is not end-to-end encryption from the operator. Do
            not submit personal, clinical, controlled, or unpublished sensitive sequences; use an
            institutionally approved private route. The bundled example is matched locally and is
            never submitted.
          </p>
        </details>
      </div>
      <div class="submit-bar">
        <div>
          <span>{{ selectedMode.tools.join(" → ") }}</span>
        </div>
        <button
          class="primary-button"
          type="submit"
          :disabled="!ready || submitting"
        >
          {{
            submitting
              ? precomputedPolicyMatches
                ? "Loading result…"
                : "Submitting…"
              : hasActiveJob
                ? "Current job still open"
                : precomputedPolicyMatches
                  ? "View precomputed result"
                  : ["protospacer", "viral_search"].includes(mode)
                    ? "Search references"
                    : "Compute"
          }}<AppIcon name="arrow" />
        </button>
      </div>
    </form>
  </section>
</template>
