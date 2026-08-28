<script setup>
import AppIcon from "../common/AppIcon.vue";
import BrandMark from "../common/BrandMark.vue";
import HeroVisual from "./HeroVisual.vue";
import ServiceStatus from "./ServiceStatus.vue";

defineProps({ service: { type: Object, required: true } });
</script>

<template>
  <header
    id="top"
    class="hero"
  >
    <div class="nav-shell">
      <BrandMark />
      <nav aria-label="Primary navigation">
        <a href="#workflow">Analyze</a><a href="#references">References</a
        ><ServiceStatus :service="service" />
      </nav>
    </div>
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="hero-suite">
          <span>CRISPRidentify</span><i /><span>SpacerPlacer</span><i /><span>CRISPR-evOr</span>
        </p>
        <h1 aria-label="CRISPR array detection. Evolutionary order and orientation.">
          <span>CRISPR array detection.</span><em>Evolutionary order &amp; orientation.</em>
        </h1>
        <p class="hero-lead">
          Run detection alone—or reconstruct related arrays and compare input versus reversed
          acquisition order in a separate analysis.
        </p>
        <a
          class="hero-action"
          href="#analysis-form"
          >Start an analysis
          <AppIcon
            name="arrow"
            :size="17"
        /></a>
      </div>
      <HeroVisual />
    </div>
  </header>
</template>
