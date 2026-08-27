<script setup>
import { computed, ref, watch } from "vue";

import { api } from "../../api.js";
import { asArray } from "../../utils/formatting.js";
import { MAX_ADAPTER_MANIFEST_BYTES, adapterHasMembership, mergeAdapterMembership, sanitizeAdapterMembership } from "../../utils/results.js";
import AppIcon from "../common/AppIcon.vue";
import DetectionSummary from "./DetectionSummary.vue";
import DownloadsPanel from "./DownloadsPanel.vue";
import EvidenceMap from "./EvidenceMap.vue";
import OrientationResults from "./OrientationResults.vue";
import PreflightSummary from "./PreflightSummary.vue";
import ProvenancePanel from "./ProvenancePanel.vue";
import ReconstructionResults from "./ReconstructionResults.vue";
import ResultSynopsis from "./ResultSynopsis.vue";

const props = defineProps({ job: { type: Object, default: null }, credential: { type: Object, default: null }, maxArchiveBytes: { type: Number, default: 0 }, exampleSnapshot: { type: Object, default: null } });
const sourceSummary = computed(() => props.job?.summary || props.job?.result || {});
const artifactGroups = ref(null);
const membershipStatus = ref("idle");

watch([sourceSummary, () => props.credential], async ([summary, credential], _old, onCleanup) => {
  if (adapterHasMembership(summary)) {
    artifactGroups.value = null;
    membershipStatus.value = "inline";
    return;
  }
  const artifact = asArray(props.job?.artifacts || summary?.artifacts).find((item) => String(item?.name || item?.filename || "") === "adapter/manifest.json");
  const artifactId = artifact ? String(artifact.artifact_id || artifact.id || "") : "";
  if (!artifactId || !credential?.jobId || !credential?.accessToken) {
    artifactGroups.value = null;
    membershipStatus.value = "unavailable";
    return;
  }
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  artifactGroups.value = null;
  membershipStatus.value = "loading";
  try {
    const blob = await api.downloadArtifact(credential.jobId, artifactId, credential.accessToken, { signal: controller.signal });
    if (Number(blob?.size) > MAX_ADAPTER_MANIFEST_BYTES) throw new Error("Adapter manifest is too large.");
    const text = await blob.text();
    if (new TextEncoder().encode(text).byteLength > MAX_ADAPTER_MANIFEST_BYTES) throw new Error("Adapter manifest is too large.");
    const groups = sanitizeAdapterMembership(JSON.parse(text));
    if (!groups.some((group) => group.arrays.length)) throw new Error("Adapter manifest has no valid membership.");
    artifactGroups.value = groups;
    membershipStatus.value = "loaded";
  } catch (error) {
    if (error.name !== "AbortError") membershipStatus.value = "unavailable";
  }
}, { immediate: true });

const summary = computed(() => mergeAdapterMembership(sourceSummary.value, artifactGroups.value));
const completed = computed(() => ["completed", "completed_no_eligible_groups"].includes(props.job?.status));
const noEligible = computed(() => props.job?.status === "completed_no_eligible_groups");
const detection = computed(() => summary.value?.detection || summary.value || {});
const arrays = computed(() => asArray(detection.value.arrays || detection.value.detected_arrays));
</script>

<template>
  <section v-if="completed" class="results" aria-labelledby="results-heading">
    <div class="results-title"><div><h2 id="results-heading" tabindex="-1"><span class="sr-only">Analysis result</span> {{ noEligible ? 'Detection succeeded; evolution was not applicable.' : 'Evidence, with its limits visible.' }}</h2></div><span class="complete-stamp"><AppIcon name="check"/> Completed</span></div>
    <nav class="result-jump-nav" aria-label="Result sections"><span>Result map</span><a href="#synopsis-heading">Synopsis</a><a v-if="!noEligible" href="#orientation-heading">CRISPR-evOr</a><a v-if="!noEligible" href="#reconstruction-heading">SpacerPlacer</a><a href="#category-heading">Detection</a><a v-if="!noEligible" href="#group-map-heading">Evidence chain</a><a href="#preflight-heading">Preflight</a><a href="#provenance-heading">Provenance</a></nav>
    <div v-if="noEligible" class="no-eligible" role="status"><AppIcon name="info"/><div><strong>No eligible evolutionary groups</strong><p>The workflow completed successfully and detection remains valid, but no group passed the selected category, similarity, record-count, and strand rules. No evolutionary or orientation claim was made.</p></div></div>
    <ResultSynopsis :summary="summary" :example-snapshot="exampleSnapshot" :no-eligible="noEligible"/>
    <DetectionSummary :summary="detection" :arrays="arrays"/>
    <PreflightSummary :summary="summary"/>
    <EvidenceMap v-if="!noEligible" :summary="summary" :membership-status="membershipStatus"/>
    <OrientationResults v-if="!noEligible" :summary="summary"/>
    <ReconstructionResults v-if="!noEligible" :summary="summary"/>
    <ProvenancePanel :job="job" :summary="summary"/>
    <DownloadsPanel v-if="credential && !exampleSnapshot" :job="job" :credential="credential" :max-archive-bytes="maxArchiveBytes"/>
  </section>
</template>
