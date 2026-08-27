<script setup>
import { ref } from "vue";

import { parseJobCredential } from "../../jobStore.js";
import AppIcon from "../common/AppIcon.vue";

const emit = defineEmits(["resume"]);
const error = ref("");

async function load(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  if (file.size > 16_384) {
    error.value = "Recovery file exceeds 16 KiB.";
    return;
  }
  try {
    emit("resume", parseJobCredential(await file.text()));
    error.value = "";
  } catch (loadError) {
    error.value = loadError.message || "Recovery file could not be read.";
  }
}
</script>

<template>
  <section class="resume-job" aria-labelledby="resume-heading"><div><h2 id="resume-heading"><span>Already submitted?</span> Resume with a private recovery file.</h2><p id="resume-description">The file is parsed locally, then its bearer token is sent only in the API Authorization header.</p></div><label class="resume-button"><AppIcon name="upload" :size="17"/>Choose recovery JSON<input type="file" accept=".json,application/json" aria-describedby="resume-description" @change="load"></label><p v-if="error" class="resume-error" role="alert">{{ error }}</p></section>
</template>
