<script setup>
import { computed, ref } from "vue";

import { ApiError, api } from "../../api.js";
import { EXAMPLE_FASTA_PATH, EXAMPLE_RESULT_PATH, validateExampleInput } from "../../example.js";
import { inspectFasta } from "../../fasta.js";
import { normalizeJobCredential } from "../../jobStore.js";
import { ANALYSIS_MODES } from "../../science.js";
import { buildSubmission } from "../../submission.js";
import AppIcon from "../common/AppIcon.vue";
import AdvancedOptions from "./AdvancedOptions.vue";
import FastaInput from "./FastaInput.vue";
import ModeSelector from "./ModeSelector.vue";
import ReadinessPanel from "./ReadinessPanel.vue";

const INITIAL_OPTIONS = Object.freeze({ categoryPolicy: "bona_fide_possible", spacerEditDistance: 1, biasCorrection: true });
const props = defineProps({ service: { type: Object, required: true }, limits: { type: Object, required: true }, hasActiveJob: Boolean });
const emit = defineEmits(["submitted", "example-loaded"]);

const mode = ref("orientation");
const sequence = ref("");
const filename = ref("input.fasta");
const options = ref({ ...INITIAL_OPTIONS });
const submitting = ref(false);
const loadingExample = ref(false);
const error = ref("");
const preparedExample = ref(null);
const preparedExampleSequence = ref("");
let submittingLatch = false;
let exampleLatch = false;

const inspection = computed(() => inspectFasta(sequence.value, { maxHeaderCharacters: props.limits.maxHeaderCharacters || 200 }));
const selectedMode = computed(() => ANALYSIS_MODES.find((item) => item.id === mode.value));
const submission = computed(() => buildSubmission({ sequence: sequence.value, filename: filename.value, mode: mode.value, options: options.value }));
const requestBytes = computed(() => new TextEncoder().encode(JSON.stringify(submission.value)).byteLength);
const precomputedPolicyMatches = computed(() => {
  const recorded = preparedExample.value?.job?.options;
  return Boolean(preparedExample.value && sequence.value === preparedExampleSequence.value && mode.value === preparedExample.value.job?.mode && submission.value.category_policy === recorded?.category_policy && submission.value.spacer_distance === recorded?.spacer_distance && submission.value.bias_corrections === recorded?.bias_corrections_requested);
});
const withinLimits = computed(() => (!props.limits.maxRecords || inspection.value.recordCount <= props.limits.maxRecords) && (!props.limits.maxBases || inspection.value.baseCount <= props.limits.maxBases) && (!props.limits.maxRecordBases || inspection.value.records.every((record) => record.sequence.length <= props.limits.maxRecordBases)));
const withinRequest = computed(() => !props.limits.maxRequestBytes || requestBytes.value <= props.limits.maxRequestBytes);
const ready = computed(() => inspection.value.valid && inspection.value.recordCount >= selectedMode.value.minimumRecords && withinLimits.value && withinRequest.value && (props.service.state === "online" || precomputedPolicyMatches.value) && !props.hasActiveJob);

async function loadExample() {
  if (exampleLatch) return;
  exampleLatch = true;
  loadingExample.value = true;
  error.value = "";
  try {
    const [inputResponse, resultResponse] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}${EXAMPLE_FASTA_PATH}`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }),
      fetch(`${import.meta.env.BASE_URL}${EXAMPLE_RESULT_PATH}`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }),
    ]);
    if (!inputResponse.ok || !resultResponse.ok) throw new Error("The example demonstration could not be loaded.");
    const [exampleSequence, rawSnapshot] = await Promise.all([inputResponse.text(), resultResponse.json()]);
    const { snapshot } = await validateExampleInput(rawSnapshot, exampleSequence, { maxHeaderCharacters: props.limits.maxHeaderCharacters || 200 });
    mode.value = "orientation";
    options.value = { ...INITIAL_OPTIONS };
    sequence.value = exampleSequence;
    filename.value = snapshot.example.input.filename;
    preparedExample.value = snapshot;
    preparedExampleSequence.value = exampleSequence;
    emit("example-loaded", null);
  } catch (loadError) {
    error.value = loadError.message || "The example demonstration could not be loaded.";
  } finally {
    exampleLatch = false;
    loadingExample.value = false;
  }
}

async function submit() {
  if (!ready.value || submittingLatch) return;
  submittingLatch = true;
  submitting.value = true;
  error.value = "";
  try {
    if (precomputedPolicyMatches.value) {
      await validateExampleInput(preparedExample.value, sequence.value, { maxHeaderCharacters: props.limits.maxHeaderCharacters || 200 });
      emit("example-loaded", preparedExample.value);
      return;
    }
    const response = await api.submit(submission.value);
    const submittedJob = response?.job || response;
    const jobId = response?.job_id || submittedJob?.job_id || submittedJob?.id;
    if (!jobId || !response?.access_token) throw new ApiError("The service returned an incomplete job credential.");
    const credential = normalizeJobCredential({ jobId, accessToken: response.access_token, expiresAt: response?.expires_at || submittedJob?.expires_at });
    emit("submitted", credential, { ...submittedJob, mode: mode.value });
  } catch (submitError) {
    error.value = submitError.message || "The analysis could not be submitted.";
  } finally {
    submittingLatch = false;
    submitting.value = false;
  }
}
</script>

<template>
  <section id="workflow" class="workflow" aria-labelledby="workflow-title">
    <div class="section-intro"><h2 id="workflow-title">Make the question explicit before running the model.</h2><p>Detection confidence and evolutionary evidence answer different questions. This workflow keeps them separate.</p></div>
    <form id="analysis-form" novalidate @submit.prevent="submit">
      <ModeSelector v-model="mode"/>
      <div class="input-section"><div class="section-title"><span><b>2</b> Provide related genomic records</span><small>DNA FASTA · unique sequence identifiers</small></div><div class="input-layout"><FastaInput v-model:sequence="sequence" v-model:filename="filename" :inspection="inspection" :loading-example="loadingExample" :example-disabled="hasActiveJob" :max-request-bytes="limits.maxRequestBytes" @load-example="loadExample"/><ReadinessPanel :inspection="inspection" :selected-mode="selectedMode" :limits="limits" :service="service" :request-bytes="requestBytes"/></div></div>
      <div class="policy-section"><div class="section-title"><span><b>3</b> Review analysis policy</span><small>No arbitrary command-line arguments are accepted</small></div><AdvancedOptions v-model="options" :mode="mode"/></div>
      <div v-if="error" class="submit-error" role="alert"><AppIcon name="warning"/><span>{{ error }}</span></div>
      <div v-if="hasActiveJob" class="active-job-lock" role="status"><AppIcon name="info"/><span><strong>Another job is open.</strong> Save its recovery file, then cancel it or leave it after completion.</span></div>
      <div class="privacy-notice" role="note" aria-label="Sequence privacy and retention notice"><AppIcon name="shield"/><p><strong>This public interface is for non-sensitive research data only.</strong> Submission sends sequence data to the service operator for analysis. The exact bundled masked example is matched locally and its cached result is never submitted. The job token protects result retrieval; it is not end-to-end encryption from the operator. Terminal job data is automatically deleted {{ service.expiresHours ? `${service.expiresHours} hours after the run finishes` : 'under the configured retention policy' }}. Do not submit personal, clinical, controlled, or unpublished sensitive sequences; use an institutionally approved private route instead.</p></div>
      <div class="submit-bar"><div><strong>{{ selectedMode.title }}</strong><span>{{ selectedMode.tools.join(' → ') }}</span></div><button class="primary-button" type="submit" :disabled="!ready || submitting">{{ submitting ? (precomputedPolicyMatches ? 'Loading result…' : 'Submitting…') : hasActiveJob ? 'Current job still open' : precomputedPolicyMatches ? 'View precomputed result' : 'Compute' }}<AppIcon name="arrow"/></button></div>
    </form>
  </section>
</template>
