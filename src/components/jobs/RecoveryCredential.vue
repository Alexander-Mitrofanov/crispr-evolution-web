<script setup>
import { serializeJobCredential } from "../../jobStore.js";
import { saveBlob } from "../../utils/download.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({ credential: { type: Object, required: true } });
function download() {
  saveBlob(new Blob([serializeJobCredential(props.credential)], { type: "application/json" }), `crispr-job-${props.credential.jobId}.recovery.json`);
}
</script>

<template>
  <div class="credential-notice" role="note" aria-label="Private job recovery credential"><AppIcon name="shield"/><div><strong>Save access before closing this page.</strong><p>The bearer credential stays only in this tab’s memory and is never written to browser storage or a URL. Anyone holding the downloaded file can access this job until it expires.</p></div><button type="button" @click="download"><AppIcon name="download" :size="16"/>Download recovery file</button></div>
</template>
