<script setup>
import AppIcon from "../common/AppIcon.vue";
import BrandMark from "../common/BrandMark.vue";
import ServiceStatus from "./ServiceStatus.vue";

defineProps({ service: { type: Object, required: true } });
</script>

<template>
  <header id="top" class="hero">
    <div class="nav-shell">
      <BrandMark/>
      <nav aria-label="Primary navigation"><a href="#workflow">Analyze</a><a href="#scope">Scope</a><ServiceStatus :service="service"/></nav>
    </div>
    <div class="hero-grid">
      <div>
        <p class="hero-suite"><span>CRISPRidentify</span><i/><span>SpacerPlacer</span><i/><span>CRISPR-evOr</span></p>
        <h1>Trace spacer arrays.<em>Test their evolutionary order.</em></h1>
        <p class="hero-lead">Detect CRISPR arrays, reconstruct ancestral spacer gains and losses, and compare input versus reversed acquisition-order hypotheses through one transparent workflow.</p>
        <a class="hero-action" href="#analysis-form">Start an analysis <AppIcon name="arrow" :size="17"/></a>
      </div>
      <div class="array-figure" aria-label="Illustration of evolving CRISPR spacer arrays">
        <div class="figure-label"><span>ARRAY EVOLUTION</span><b>gain · loss · order</b></div>
        <div v-for="row in 3" :key="row" :class="['array-row', `array-row-${row}`]">
          <small>{{ String(row).padStart(2, '0') }}</small>
          <span v-for="spacer in 7 - row" :key="spacer" :class="['spacer', `spacer-${((spacer + row) % 4) + 1}`]"/>
        </div>
        <div class="figure-axis"><span>ancestral</span><span>observed</span></div>
        <p class="figure-note"><AppIcon name="info" :size="16"/> Model evidence, not a functional annotation.</p>
      </div>
    </div>
  </header>
</template>
