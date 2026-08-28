<script setup>
import { useAnalysisForm } from "../../features/submission/index.js";
import AppIcon from "../common/AppIcon.vue";
import AdvancedOptions from "./AdvancedOptions.vue";
import FastaInput from "./FastaInput.vue";
import ModeSelector from "./ModeSelector.vue";
import ReadinessPanel from "./ReadinessPanel.vue";

const props = defineProps({
  service: { type: Object, required: true },
  limits: { type: Object, required: true },
  hasActiveJob: Boolean,
});
const emit = defineEmits(["submitted", "example-loaded"]);
const {
  mode,
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
    <div class="section-intro">
      <h2 id="workflow-title">Make the question explicit before running the model.</h2>
      <p>
        Detection confidence and evolutionary evidence answer different questions. This workflow
        keeps them separate.
      </p>
    </div>
    <form
      id="analysis-form"
      novalidate
      @submit.prevent="submit"
    >
      <ModeSelector v-model="mode" />
      <section
        class="input-section"
        aria-labelledby="input-step-heading"
      >
        <h3
          id="input-step-heading"
          class="section-title"
        >
          <span><b>2</b> Provide related genomic records</span
          ><small>DNA FASTA · unique sequence identifiers</small>
        </h3>
        <div class="input-layout">
          <FastaInput
            v-model:sequence="sequence"
            v-model:filename="filename"
            :inspection="inspection"
            :loading-example="loadingExample"
            :example-disabled="hasActiveJob"
            :max-request-bytes="limits.maxRequestBytes"
            @load-example="loadExample"
          /><ReadinessPanel
            :inspection="inspection"
            :selected-mode="selectedMode"
            :limits="limits"
            :service="service"
            :request-bytes="requestBytes"
          />
        </div>
      </section>
      <section
        class="policy-section"
        aria-labelledby="policy-step-heading"
      >
        <h3
          id="policy-step-heading"
          class="section-title"
        >
          <span><b>3</b> Review analysis policy</span
          ><small>No arbitrary command-line arguments are accepted</small>
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
          <strong>This public interface is for non-sensitive research data only.</strong> Submission
          sends sequence data to the service operator for analysis. The exact bundled masked example
          is matched locally and its cached result is never submitted. The job token protects result
          retrieval; it is not end-to-end encryption from the operator. Terminal job data is
          automatically deleted
          {{
            service.expiresHours
              ? `${service.expiresHours} hours after the run finishes`
              : "under the configured retention policy"
          }}. Do not submit personal, clinical, controlled, or unpublished sensitive sequences; use
          an institutionally approved private route instead.
        </p>
      </div>
      <div class="submit-bar">
        <div>
          <strong>{{ selectedMode.title }}</strong
          ><span>{{ selectedMode.tools.join(" → ") }}</span>
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
                  : "Compute"
          }}<AppIcon name="arrow" />
        </button>
      </div>
    </form>
  </section>
</template>
