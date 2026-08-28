import { computed, ref } from "vue";

import { ApiError, api } from "../../api.js";
import { EXAMPLE_FASTA_PATH, EXAMPLE_RESULT_PATH, validateExampleInput } from "../../example.js";
import { inspectFasta } from "../../fasta.js";
import { normalizeJobCredential } from "../../jobStore.js";
import { ANALYSIS_MODES, DEFAULT_CATEGORY_POLICY } from "../../science.js";
import { buildSubmission } from "../../submission.js";

const INITIAL_OPTIONS = Object.freeze({
  categoryPolicy: DEFAULT_CATEGORY_POLICY,
  spacerEditDistance: 1,
  biasCorrection: true,
});

export function useAnalysisForm(props, emit, client = api, fetcher = globalThis.fetch) {
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

  const inspection = computed(() =>
    inspectFasta(sequence.value, {
      maxHeaderCharacters: props.limits.maxHeaderCharacters || 200,
    }),
  );
  const selectedMode = computed(() => ANALYSIS_MODES.find((item) => item.id === mode.value));
  const submission = computed(() =>
    buildSubmission({
      sequence: sequence.value,
      filename: filename.value,
      mode: mode.value,
      options: options.value,
    }),
  );
  const requestBytes = computed(
    () => new TextEncoder().encode(JSON.stringify(submission.value)).byteLength,
  );
  const precomputedPolicyMatches = computed(() => {
    const recorded = preparedExample.value?.job?.options;
    return Boolean(
      preparedExample.value &&
      sequence.value === preparedExampleSequence.value &&
      mode.value === preparedExample.value.job?.mode &&
      submission.value.category_policy === recorded?.category_policy &&
      submission.value.spacer_distance === recorded?.spacer_distance &&
      submission.value.bias_corrections === recorded?.bias_corrections_requested,
    );
  });
  const withinLimits = computed(
    () =>
      (!props.limits.maxRecords || inspection.value.recordCount <= props.limits.maxRecords) &&
      (!props.limits.maxBases || inspection.value.baseCount <= props.limits.maxBases) &&
      (!props.limits.maxRecordBases ||
        inspection.value.records.every(
          (record) => record.sequence.length <= props.limits.maxRecordBases,
        )),
  );
  const withinRequest = computed(
    () => !props.limits.maxRequestBytes || requestBytes.value <= props.limits.maxRequestBytes,
  );
  const ready = computed(
    () =>
      inspection.value.valid &&
      inspection.value.recordCount >= selectedMode.value.minimumRecords &&
      withinLimits.value &&
      withinRequest.value &&
      (props.service.state === "online" || precomputedPolicyMatches.value) &&
      !props.hasActiveJob,
  );

  async function loadExample() {
    if (exampleLatch) return;
    exampleLatch = true;
    loadingExample.value = true;
    error.value = "";
    try {
      const [inputResponse, resultResponse] = await Promise.all([
        fetcher(`${import.meta.env.BASE_URL}${EXAMPLE_FASTA_PATH}`, {
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        }),
        fetcher(`${import.meta.env.BASE_URL}${EXAMPLE_RESULT_PATH}`, {
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        }),
      ]);
      if (!inputResponse.ok || !resultResponse.ok) {
        throw new Error("The example demonstration could not be loaded.");
      }
      const [exampleSequence, rawSnapshot] = await Promise.all([
        inputResponse.text(),
        resultResponse.json(),
      ]);
      const { snapshot } = await validateExampleInput(rawSnapshot, exampleSequence, {
        maxHeaderCharacters: props.limits.maxHeaderCharacters || 200,
      });
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
        await validateExampleInput(preparedExample.value, sequence.value, {
          maxHeaderCharacters: props.limits.maxHeaderCharacters || 200,
        });
        emit("example-loaded", preparedExample.value);
        return;
      }
      const response = await client.submit(submission.value);
      const submittedJob = response?.job || response;
      const jobId = response?.job_id || submittedJob?.job_id || submittedJob?.id;
      if (!jobId || !response?.access_token) {
        throw new ApiError("The service returned an incomplete job credential.");
      }
      const credential = normalizeJobCredential({
        jobId,
        accessToken: response.access_token,
        expiresAt: response?.expires_at || submittedJob?.expires_at,
      });
      emit("submitted", credential, { ...submittedJob, mode: mode.value });
    } catch (submitError) {
      error.value = submitError.message || "The analysis could not be submitted.";
    } finally {
      submittingLatch = false;
      submitting.value = false;
    }
  }

  return {
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
  };
}
