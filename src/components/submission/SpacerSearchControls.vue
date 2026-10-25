<script setup>
import { useId } from "vue";
import { analysisModeAvailable } from "../../science.js";
defineProps({
  mode: { type: String, required: true },
  mismatches: { type: Number, default: 2 },
  service: { type: Object, required: true },
});
defineEmits(["direction", "update:mismatches"]);
const directionId = useId();
const directions = [
  {
    id: "protospacer",
    title: "Find spacers in my sequence",
    input: "Your DNA sequence",
    reference: "Reference spacers",
    detail: "Check a contig or genome for full-length exact matches to known spacers.",
  },
  {
    id: "viral_search",
    title: "Find viruses for my spacers",
    input: "Your spacer sequences",
    reference: "Viral reference genomes",
    detail: "Search short spacers against viral RefSeq and retain candidate viral matches.",
  },
];
</script>
<template>
  <section
    class="spacer-workspace"
    aria-label="Spacer search direction"
  >
    <label
      class="spacer-direction-picker"
      :for="directionId"
      >Search direction
      <select
        :id="directionId"
        :value="mode"
        @change="$emit('direction', $event.target.value)"
      >
        <option
          v-for="item in directions"
          :key="item.id"
          :value="item.id"
        >
          {{ item.title }}
        </option>
      </select>
      <small v-if="!analysisModeAvailable(mode, service)"
        >Reference unavailable on this server; precomputed example available</small
      >
    </label>
    <div class="spacer-directions">
      <button
        v-for="item in directions"
        :key="item.id"
        type="button"
        :aria-pressed="mode === item.id"
        :aria-label="item.title"
        @click="$emit('direction', item.id)"
      >
        <strong>{{ item.title }}</strong>
        <span class="spacer-flow"
          ><span>{{ item.input }}</span
          ><span aria-hidden="true">→</span><span>{{ item.reference }}</span></span
        >

        <small v-if="!analysisModeAvailable(item.id, service)"
          >Reference unavailable on this server; precomputed example available</small
        >
      </button>
    </div>
    <div
      v-if="mode === 'viral_search'"
      class="spacer-method-note"
    >
      <div>
        <strong>Spacer FASTA · 18–80 nt per record, A/C/G/T.</strong>
      </div>
      <label for="viral-mismatches"
        >Maximum substitutions
        <select
          id="viral-mismatches"
          :value="mismatches"
          @change="$emit('update:mismatches', Number($event.target.value))"
        >
          <option :value="0">0 — exact aligned match</option>
          <option :value="1">1 substitution</option>
          <option :value="2">2 substitutions</option>
        </select>
        <small>Full-length, ungapped alignments on both strands.</small>
      </label>
      <details class="spacer-interpretation">
        <summary>Search interpretation and limits</summary>
        <p>
          Shorter or ambiguous spacers are reported as skipped. Viral RefSeq includes phages and
          other viruses; individual records may represent genome segments. BLAST can miss matches,
          including alignments it clips at the ends. Candidate viral matches do not establish
          infection or host range.
        </p>
      </details>
    </div>
    <div
      v-else
      class="spacer-method-note"
    >
      <div>
        <strong>Target DNA · exact matches to reference spacers on both strands</strong>
      </div>
      <details class="spacer-interpretation">
        <summary>Search interpretation and limits</summary>
        <p>
          Search the NCBI-hosted 2017 research spacer collection, a fixed research snapshot. Targets
          are searched as linear sequences. Array overlap and PAM compatibility are not assessed;
          matches do not establish functional targeting.
        </p>
      </details>
    </div>
  </section>
</template>
<style scoped>
.spacer-direction-picker {
  display: none;
}
.spacer-workspace {
  margin: 1rem 0;
}
.spacer-directions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.spacer-directions button {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem;
  text-align: left;
  background: white;
  color: var(--ink);
  border: 1px solid var(--line-dark);
  border-radius: 0.6rem;
}
.spacer-directions button[aria-pressed="true"] {
  border: 2px solid var(--action);
  padding: calc(0.8rem - 1px);
  background: #f0f8f7;
}
.spacer-directions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.spacer-directions strong {
  font-size: 1.1rem;
}
.spacer-directions button > span:last-of-type {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--ink-soft);
}
.spacer-flow {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--action);
}
.spacer-method-note {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem 2rem;
  padding: 0.75rem 0 0;
}
.spacer-method-note p {
  max-width: 70ch;
  margin: 0.5rem 0 0;
  line-height: 1.45;
  color: var(--ink-soft);
}
.spacer-method-note label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 600;
}
.spacer-method-note select {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--line-dark);
  border-radius: 0.35rem;
  background: white;
  color: var(--ink);
}
.spacer-method-note small {
  font-weight: 400;
  color: var(--ink-soft);
}
.spacer-interpretation {
  grid-column: 1 / -1;
  font-size: 0.9rem;
}
@media (max-width: 680px) {
  .spacer-directions {
    display: none;
  }
  .spacer-direction-picker {
    display: grid;
    gap: 6px;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .spacer-direction-picker select {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 10px;
    border: 1px solid var(--line-dark);
    border-radius: var(--radius-sm);
    color: var(--ink);
    background: var(--paper);
    font: inherit;
  }
  .spacer-direction-picker small {
    font-weight: 400;
  }
  .spacer-method-note {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .spacer-method-note strong {
    font-size: 0.875rem;
    font-weight: 500;
  }
  .spacer-method-note label {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    font-size: 0.875rem;
  }
  .spacer-method-note label small {
    grid-column: 1 / -1;
  }
  .spacer-method-note select {
    width: 100%;
    min-width: 0;
  }

  .spacer-flow {
    flex-wrap: wrap;
  }
}
</style>
