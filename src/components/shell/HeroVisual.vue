<script setup>
const visualSource = `${import.meta.env.BASE_URL}evor-orientation.svg`;

const visualAlt = [
  "The same related CRISPR arrays compared in input and reversed spacer order;",
  "each history is reconstructed and their likelihoods are compared to support an acquisition orientation.",
].join(" ");
</script>

<template>
  <figure class="hero-visual">
    <img
      :src="visualSource"
      :alt="visualAlt"
      aria-describedby="evor-visual-credit"
      width="560"
      height="320"
      decoding="async"
      fetchpriority="high"
    />
    <figcaption id="evor-visual-credit">
      Adapted from
      <a
        href="https://doi.org/10.1371/journal.pcbi.1013706"
        target="_blank"
        rel="noopener noreferrer"
        >Fehrenbach et al. (2025), Fig. 1</a
      >,
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        >CC BY 4.0</a
      >.
    </figcaption>
  </figure>
</template>

<style scoped>
.hero-visual {
  width: min(100%, 560px);
  margin: 0;
}

.hero-visual img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 20px;
}

.hero-visual figcaption {
  margin: 9px 12px 0;
  color: var(--on-night-muted, #aebbd5);
  font-size: 0.72rem;
  line-height: 1.45;
}

.hero-visual a {
  color: inherit;
  text-decoration-color: currentcolor;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.hero-visual a:hover {
  color: var(--on-night, #ffffff);
}

.hero-visual a:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--focus-dark, #b9d7ff);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .hero-visual,
  .hero-visual * {
    scroll-behavior: auto;
  }
}
</style>
