<script setup>
defineProps({
  status: { type: String, default: "not_run" },
  predictions: { type: Array, default: null },
});
const metric = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "Not available";
</script>

<template>
  <section aria-label="Cas9 PAM prediction">
    <h4>Cas9 PAM prediction · CICERO</h4>
    <p
      v-if="status === 'unavailable'"
      class="annotation-notice"
    >
      PAM prediction is unavailable. Model permissions and CPU validation are pending. No motif or
      confidence score was calculated.
    </p>
    <p
      v-else-if="status !== 'completed'"
      class="annotation-lead"
    >
      PAM prediction was not run for this result.
    </p>
    <template v-else>
      <div
        v-for="protein in predictions || []"
        :key="protein.id"
      >
        <h5>{{ protein.id }}</h5>
        <p>Predicted motif similarity: {{ metric(protein.confidence) }}</p>
        <div
          class="annotation-scroll"
          tabindex="0"
          role="region"
          :aria-label="`PAM probabilities for ${protein.id}`"
        >
          <table class="annotation-table">
            <thead>
              <tr>
                <th scope="col">PAM position</th>
                <th
                  v-for="base in ['A', 'C', 'G', 'T']"
                  :key="base"
                  scope="col"
                >
                  {{ base }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(position, index) in protein.probabilities || []"
                :key="index"
              >
                <th scope="row">{{ index + 1 }}</th>
                <td
                  v-for="base in [0, 1, 2, 3]"
                  :key="base"
                >
                  {{ metric(position?.[base]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    <p class="annotation-lead">
      CICERO applies to Cas9 proteins. Its five-fold model predicts a 10-position A/C/G/T motif.
      Confidence estimates motif similarity, not cleavage or editing success. Protein associations
      do not establish target or PAM coordinates.
    </p>
  </section>
</template>
