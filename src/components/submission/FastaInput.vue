<script setup>
import { ref } from "vue";

import { readableBases } from "../../fasta.js";
import { readableBytes } from "../../utils/formatting.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({
  sequence: { type: String, required: true },
  filename: { type: String, required: true },
  inspection: { type: Object, required: true },
  loadingExample: Boolean,
  exampleDisabled: Boolean,
  maxRequestBytes: { type: Number, default: 0 },
});
const emit = defineEmits(["update:sequence", "update:filename", "load-example"]);
const fileInput = ref(null);
const fileError = ref("");

function updateSequence(value) {
  emit("update:sequence", value);
  emit("update:filename", "pasted-input.fasta");
  fileError.value = "";
}

async function onFile(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  const margin = props.maxRequestBytes
    ? Math.min(65_536, Math.floor(props.maxRequestBytes * 0.05))
    : 0;
  const limit = props.maxRequestBytes ? Math.max(1, props.maxRequestBytes - margin) : 0;
  if (limit && file.size > limit) {
    fileError.value = `The selected file is ${readableBytes(file.size)}. It must be smaller than ${readableBytes(limit)} so the JSON request fits the service limit.`;
    return;
  }
  try {
    emit("update:sequence", await file.text());
    emit("update:filename", file.name);
    fileError.value = "";
  } catch {
    fileError.value = "The selected file could not be read as plain text.";
  }
}
</script>

<template>
  <div class="input-panel">
    <div
      id="example-entry"
      class="input-heading"
    >
      <div>
        <label for="fasta-input">Related contigs or small genomes</label>
        <p>
          Paste FASTA or upload a plain-text file. The first token in every header must be unique.
        </p>
      </div>
      <button
        class="text-button example-button"
        type="button"
        :disabled="loadingExample || exampleDisabled"
        :title="
          exampleDisabled
            ? 'Finish or leave the current job before opening the example.'
            : undefined
        "
        @click="$emit('load-example')"
      >
        <AppIcon
          name="file"
          :size="16"
        />{{ loadingExample ? "Loading example…" : "Load flagship example" }}
      </button>
    </div>
    <div class="upload-strip">
      <button
        class="upload-button"
        type="button"
        @click="fileInput?.click()"
      >
        <AppIcon
          name="upload"
          :size="18"
        />
        Upload FASTA
      </button>
      <input
        ref="fileInput"
        type="file"
        tabindex="-1"
        accept=".fa,.fasta,.fna,.ffn,.fas,.txt,text/plain"
        aria-label="Upload FASTA file"
        @change="onFile"
      />
      <span class="filename">{{ sequence ? filename : "No file selected" }}</span>
      <span class="input-stats"
        ><b>{{ inspection.recordCount }}</b> records <i />
        <b>{{ readableBases(inspection.baseCount) }}</b></span
      >
    </div>
    <textarea
      id="fasta-input"
      spellcheck="false"
      :value="sequence"
      placeholder=">isolate_A&#10;ACGT…&#10;>isolate_B&#10;ACGT…"
      aria-describedby="fasta-help fasta-errors"
      @input="updateSequence($event.target.value)"
    />
    <div
      id="fasta-help"
      class="input-foot"
    >
      <span>Accepted symbols: A C G T and IUPAC ambiguity codes</span
      ><span>Input stays in this browser until submission</span>
    </div>
    <div
      id="fasta-errors"
      class="field-errors"
      role="alert"
    >
      <p v-if="fileError">{{ fileError }}</p>
      <p
        v-for="item in sequence ? inspection.errors.slice(0, 3) : []"
        :key="item"
      >
        {{ item }}
      </p>
    </div>
  </div>
</template>
