<script setup>
import { computed, ref } from "vue";

import { api } from "../../api.js";
import { saveBlob } from "../../utils/download.js";
import { asArray, downloadName, readableBytes } from "../../utils/formatting.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({ job: { type: Object, required: true }, credential: { type: Object, required: true }, maxArchiveBytes: { type: Number, default: 0 } });
const downloading = ref("");
const error = ref("");
let downloadLatch = false;
const artifacts = computed(() => asArray(props.job?.artifacts || props.job?.summary?.artifacts).filter((artifact) => !Number.isFinite(Number(artifact?.size_bytes)) || Number(artifact.size_bytes) > 0));
const bundle = computed(() => artifacts.value.find((artifact) => `${artifact?.kind || ""} ${artifact?.filename || artifact?.name || ""}`.toLowerCase().match(/bundle|archive|results\.zip/)));
const individual = computed(() => artifacts.value.filter((artifact) => artifact !== bundle.value));

async function download(artifact = null) {
  if (downloadLatch) return;
  downloadLatch = true;
  const id = artifact ? String(artifact.artifact_id || artifact.id) : "bundle";
  downloading.value = id;
  error.value = "";
  try {
    const blob = artifact ? await api.downloadArtifact(props.credential.jobId, id, props.credential.accessToken) : bundle.value ? await api.downloadArtifact(props.credential.jobId, String(bundle.value.artifact_id || bundle.value.id), props.credential.accessToken) : await api.downloadBundle(props.credential.jobId, props.credential.accessToken);
    saveBlob(blob, artifact ? downloadName(artifact.filename || artifact.name, `${id}.dat`) : `crispr-analysis-${props.credential.jobId}.zip`);
  } catch (downloadError) {
    error.value = downloadError.message || "Download failed.";
  } finally {
    downloadLatch = false;
    downloading.value = "";
  }
}
</script>

<template>
  <section class="result-section downloads" aria-labelledby="downloads-heading">
    <div class="result-heading"><div><p class="eyebrow">Export</p><h3 id="downloads-heading">Reports and result bundle</h3></div><p>Downloads are authenticated in request headers. The token never appears in a URL.</p></div>
    <p class="download-memory-note"><AppIcon name="info" :size="16"/> Authenticated files are buffered in this browser tab before saving<span v-if="maxArchiveBytes">; the archive cap is {{ readableBytes(maxArchiveBytes) }}</span>.</p>
    <button v-if="bundle" class="bundle-button" type="button" :disabled="Boolean(downloading)" @click="download()"><span><AppIcon name="download"/><i>ZIP</i></span><span><strong>{{ downloading === 'bundle' ? 'Preparing download…' : 'Download complete result bundle' }}</strong><small>Tables · trees · alignments · warnings · provenance</small></span></button><div v-else class="archive-unavailable" role="note"><AppIcon name="warning" :size="17"/><p><strong>Complete ZIP not available.</strong> Use any individual outputs listed below.</p></div>
    <div v-if="individual.length" class="artifact-grid"><button v-for="(artifact, index) in individual" :key="artifact.artifact_id || artifact.id || index" type="button" :disabled="Boolean(downloading)" @click="download(artifact)"><AppIcon name="file"/><span><strong>{{ artifact.label || artifact.filename || artifact.name || `Artifact ${index + 1}` }}</strong><small>{{ artifact.media_type || artifact.kind || 'Result file' }}</small></span><AppIcon name="download" :size="17"/></button></div>
    <p v-if="error" class="download-error" role="alert">{{ error }}</p>
  </section>
</template>
