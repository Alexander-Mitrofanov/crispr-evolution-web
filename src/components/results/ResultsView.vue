<script setup>
import { computed } from "vue";

import { normalizePublicResult, useAdapterMembership } from "../../features/results/index.js";
import { asArray } from "../../utils/formatting.js";
import { mergeAdapterMembership } from "../../utils/results.js";
import AppIcon from "../common/AppIcon.vue";
import DetectionSummary from "./overview/DetectionSummary.vue";
import EvidenceMap from "./overview/EvidenceMap.vue";
import PreflightSummary from "./overview/PreflightSummary.vue";
import ResultSynopsis from "./overview/ResultSynopsis.vue";
import OrientationResults from "./orientation/OrientationResults.vue";
import DownloadsPanel from "./publication/DownloadsPanel.vue";
import ProvenancePanel from "./publication/ProvenancePanel.vue";
import ReconstructionResults from "./reconstruction/ReconstructionResults.vue";

const props = defineProps({
  job: { type: Object, default: null },
  credential: { type: Object, default: null },
  maxArchiveBytes: { type: Number, default: 0 },
  exampleSnapshot: { type: Object, default: null },
});
const sourceSummary = computed(() =>
  normalizePublicResult(props.job?.summary || props.job?.result || {}, props.job || {}),
);
const currentJob = computed(() => props.job);
const currentCredential = computed(() => props.credential);
const { artifactGroups, membershipStatus } = useAdapterMembership(
  sourceSummary,
  currentJob,
  currentCredential,
);

const summary = computed(() => mergeAdapterMembership(sourceSummary.value, artifactGroups.value));
const completed = computed(() =>
  ["completed", "completed_no_eligible_groups"].includes(props.job?.status),
);
const noEligible = computed(() => props.job?.status === "completed_no_eligible_groups");
const detection = computed(() => summary.value.detection);
const arrays = computed(() => asArray(detection.value.arrays));
</script>

<template>
  <section
    v-if="completed"
    class="results"
    aria-labelledby="results-heading"
  >
    <div class="results-title">
      <div>
        <h2
          id="results-heading"
          tabindex="-1"
        >
          <span class="sr-only">Analysis result</span>
          {{
            noEligible
              ? "Detection succeeded; evolution was not applicable."
              : "Evidence, with its limits visible."
          }}
        </h2>
      </div>
      <span class="complete-stamp"><AppIcon name="check" /> Completed</span>
    </div>
    <nav
      class="result-jump-nav"
      aria-label="Result sections"
    >
      <span>Result map</span><a href="#synopsis-heading">Synopsis</a
      ><a
        v-if="!noEligible"
        href="#orientation-heading"
        >CRISPR-evOr</a
      ><a
        v-if="!noEligible"
        href="#reconstruction-heading"
        >SpacerPlacer</a
      ><a href="#category-heading">Detection</a
      ><a
        v-if="!noEligible"
        href="#group-map-heading"
        >Evidence chain</a
      ><a href="#preflight-heading">Preflight</a><a href="#provenance-heading">Provenance</a>
    </nav>
    <div
      v-if="noEligible"
      class="no-eligible"
      role="status"
    >
      <AppIcon name="info" />
      <div>
        <strong>No eligible evolutionary groups</strong>
        <p>
          The workflow completed successfully and detection remains valid, but no group passed the
          selected category, similarity, record-count, and strand rules. No evolutionary or
          orientation claim was made.
        </p>
      </div>
    </div>
    <ResultSynopsis
      :summary="summary"
      :example-snapshot="exampleSnapshot"
      :no-eligible="noEligible"
    />
    <DetectionSummary
      :summary="detection"
      :arrays="arrays"
    />
    <PreflightSummary :summary="summary" />
    <EvidenceMap
      v-if="!noEligible"
      :summary="summary"
      :membership-status="membershipStatus"
    />
    <OrientationResults
      v-if="!noEligible"
      :summary="summary"
    />
    <ReconstructionResults
      v-if="!noEligible"
      :summary="summary"
    />
    <ProvenancePanel :summary="summary" />
    <DownloadsPanel
      v-if="credential && !exampleSnapshot"
      :job="job"
      :credential="credential"
      :max-archive-bytes="maxArchiveBytes"
    />
  </section>
</template>
