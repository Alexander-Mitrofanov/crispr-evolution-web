<script setup>
import { toRefs } from "vue";

import { useArtifactDownloads } from "../../../features/results/index.js";
import { readableBytes } from "../../../utils/formatting.js";
import AppIcon from "../../common/AppIcon.vue";

const props = defineProps({
  job: { type: Object, required: true },
  credential: { type: Object, required: true },
  maxArchiveBytes: { type: Number, default: 0 },
});
const { job, credential } = toRefs(props);
const { bundle, individual, downloading, error, download } = useArtifactDownloads(job, credential);
</script>

<template>
  <section
    class="result-section downloads"
    aria-labelledby="downloads-heading"
  >
    <div class="result-heading">
      <div>
        <p class="eyebrow">Export</p>
        <h3 id="downloads-heading">Reports and result bundle</h3>
      </div>
      <p>Downloads are authenticated in request headers. The token never enters a download URL.</p>
    </div>
    <p class="download-memory-note">
      <AppIcon
        name="info"
        :size="16"
      />
      Authenticated files are buffered in this browser tab before saving<span v-if="maxArchiveBytes"
        >; the archive cap is {{ readableBytes(maxArchiveBytes) }}</span
      >.
    </p>
    <button
      v-if="bundle"
      class="bundle-button"
      type="button"
      :disabled="Boolean(downloading)"
      @click="download()"
    >
      <span><AppIcon name="download" /><i>ZIP</i></span
      ><span
        ><strong>{{
          downloading === "bundle" ? "Preparing download…" : "Download complete result bundle"
        }}</strong
        ><small>Tables · trees · alignments · warnings · provenance</small></span
      >
    </button>
    <div
      v-else
      class="archive-unavailable"
      role="note"
    >
      <AppIcon
        name="warning"
        :size="17"
      />
      <p><strong>Complete ZIP not available.</strong> Use any individual outputs listed below.</p>
    </div>
    <div
      v-if="individual.length"
      class="artifact-grid"
    >
      <button
        v-for="(artifact, index) in individual"
        :key="artifact.artifact_id || artifact.id || index"
        type="button"
        :disabled="Boolean(downloading)"
        @click="download(artifact)"
      >
        <AppIcon name="file" /><span
          ><strong>{{
            artifact.label || artifact.filename || artifact.name || `Artifact ${index + 1}`
          }}</strong
          ><small>{{ artifact.media_type || artifact.kind || "Result file" }}</small></span
        ><AppIcon
          name="download"
          :size="17"
        />
      </button>
    </div>
    <p
      v-if="error"
      class="download-error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>
