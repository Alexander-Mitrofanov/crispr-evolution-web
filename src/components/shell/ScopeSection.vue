<script setup>
import AppIcon from "../common/AppIcon.vue";
</script>

<template>
  <section id="scope" class="scope" aria-labelledby="scope-heading">
    <div><h2 id="scope-heading">What CRISPR-evOr can—and cannot—tell you.</h2></div>
    <div class="scope-grid">
      <article class="scope-can"><span><AppIcon name="check"/></span><h3>Evolutionary order evidence</h3><p>CRISPR-evOr compares histories in input and reversed order, conditional on detected arrays, grouping, tree, and model.</p><ul><li>Relative support for array order</li><li>Reported ancestral reconstruction</li><li>Gain/loss model summaries</li></ul></article>
      <article class="scope-cannot"><span>≠</span><h3>Not functional annotation</h3><p>Array-order support is not direct experimental evidence of molecular function or expression.</p><ul><li>No transcription direction or leader sequence</li><li>No PAMs or target sites</li><li>No genome-editing guide validation</li></ul></article>
    </div>
    <p class="scope-footnote">Treat “input” and “reverse input” as ordering hypotheses—not automatically as leader-proximal or transcribed orientations.</p>
  </section>
</template>
