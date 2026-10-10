import { validAssociationGrouping } from "./association.js";
import { computed, ref } from "vue";

import { ApiError, api } from "../../api.js";
import { EXAMPLE_FASTA_PATH, EXAMPLE_RESULT_PATH, validateExampleInput } from "../../example.js";
import { inspectSequenceInput } from "./sequenceInput.js";
import { normalizeJobCredential } from "../../jobStore.js";
import { ANALYSIS_MODES, DEFAULT_CATEGORY_POLICY, analysisModeAvailable } from "../../science.js";
import { buildSubmission } from "../../submission.js";
import { toolOptionCount, validToolOptions } from "../../toolOptions.js";

const INITIAL_OPTIONS = Object.freeze({
  categoryPolicy: DEFAULT_CATEGORY_POLICY,
  spacerEditDistance: 1,
  biasCorrection: true,
  tracrModelType: "II",
  leaderFlankLength: 500,
  molecule: "DNA",
  associationGrouping: "",
  viralMaxMismatches: 2,
  toolOptions: {},
});

export function useAnalysisForm(props, emit, client = api, fetcher = globalThis.fetch) {
  const mode = ref(props.initialMode || "loci");
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

  const molecule = computed(() => (mode.value === "repeats" ? options.value.molecule : "DNA"));
  const inputLimits = computed(() =>
    mode.value === "viral_search"
      ? { ...props.limits, maxRecordBases: Math.min(props.limits.maxRecordBases || 80, 80) }
      : ["repeats", "repeat_map", "repeat_type", "spacer_association"].includes(mode.value)
        ? {
            ...props.limits,
            maxRecords: Math.min(
              props.limits.maxRecords || 1000,
              mode.value === "repeat_map" ? 100 : 1000,
            ),
            maxRecordBases: Math.min(props.limits.maxRecordBases || 200, 200),
          }
        : props.limits,
  );

  const inspection = computed(() =>
    inspectSequenceInput(sequence.value, {
      mode: mode.value,
      maxHeaderCharacters: props.limits.maxHeaderCharacters || 200,
      molecule: molecule.value,
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
      toolOptionCount(mode.value, options.value.toolOptions) === 0 &&
      submission.value.category_policy === recorded?.category_policy &&
      submission.value.spacer_distance === recorded?.spacer_distance &&
      submission.value.bias_corrections === recorded?.bias_corrections_requested,
    );
  });
  const withinLimits = computed(
    () =>
      (!inputLimits.value.maxRecords ||
        inspection.value.recordCount <= inputLimits.value.maxRecords) &&
      (!inputLimits.value.maxBases || inspection.value.baseCount <= inputLimits.value.maxBases) &&
      (!inputLimits.value.maxRecordBases ||
        inspection.value.records.every(
          (record) => record.sequence.length <= inputLimits.value.maxRecordBases,
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
      validToolOptions(mode.value, options.value.toolOptions) &&
      (mode.value !== "spacer_association" ||
        (validAssociationGrouping(sequence.value, options.value.associationGrouping) &&
          (options.value.associationGrouping !== "per_record" ||
            inspection.value.recordCount <= 100))) &&
      (!["loci", "leader"].includes(mode.value) ||
        (Number.isInteger(options.value.leaderFlankLength) &&
          options.value.leaderFlankLength >= 1 &&
          options.value.leaderFlankLength <= 5000)) &&
      (props.service.state === "online" || precomputedPolicyMatches.value) &&
      analysisModeAvailable(mode.value, props.service) &&
      !props.hasActiveJob,
  );

  async function loadExample() {
    if (exampleLatch || mode.value !== "orientation") return;
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
  };
}
