<script setup>
defineProps({
  counts: { type: Object, default: () => ({}) },
  policy: { type: Object, default: () => ({}) },
  fold: { type: Object, default: () => ({}) },
  alignment: { type: Array, default: () => [] },
  pairs: { type: Array, default: () => [] },
  covariation: { type: Object, default: () => ({}) },
  warnings: { type: Array, default: () => [] },
});
const numeric = (value, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "Not reported";
</script>

<template>
  <section class="result-panel">
    <h3>Homologous RNA family</h3>
    <p>
      {{ counts.sources ?? "Not reported" }} supplied sequences ·
      {{ counts.unique_sequences ?? "Not reported" }} distinct sequences ·
      {{ counts.alignment_columns ?? "Not reported" }} alignment columns. MAFFT aligns the supplied
      family; RNAalifold predicts a shared structural model at 37 °C.
    </p>
    <p>
      Homology, strand orientation and candidate boundaries must be justified by the researcher.
      They are not inferred or experimentally verified by this analysis. Identical sequences are
      collapsed to one folding weight; all original identifiers remain in the downloadable
      crosswalk.
    </p>
    <dl class="rna-family-metrics">
      <div>
        <dt>Comparative MFE score</dt>
        <dd>{{ numeric(fold.mfe_score_kcal_mol) }} kcal/mol</dd>
      </div>
      <div>
        <dt>Ensemble free energy</dt>
        <dd>{{ numeric(fold.ensemble_free_energy_kcal_mol) }} kcal/mol</dd>
      </div>
      <div>
        <dt>Consensus base pairs</dt>
        <dd>{{ counts.mfe_pairs ?? "Not reported" }}</dd>
      </div>
    </dl>
    <p>Comparative scores include covariance contributions and depend on this family alignment.</p>
    <div
      class="table-scroll"
      aria-label="RNA family alignment and consensus structure"
    >
      <table class="rna-family-alignment">
        <thead>
          <tr>
            <th>Representative / original sequences</th>
            <th>Aligned RNA, 5′ to 3′</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in alignment"
            :key="row.id"
          >
            <th scope="row">
              {{ row.id }}<small>{{ row.member_ids.join(", ") }}</small>
            </th>
            <td>
              <code>{{ row.sequence }}</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Column consensus</th>
            <td>
              <code>{{ fold.consensus ?? "Not reported" }}</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Predicted structure</th>
            <td>
              <code>{{ fold.structure ?? "Not reported" }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Dots indicate unpaired columns; matching parentheses indicate a predicted pair. Consensus N
      denotes a tied column.
    </p>
    <h4>Statistical covariation (R-scape)</h4>
    <template v-if="covariation.available">
      <p v-if="covariation.status === 'uninformative'">
        The alignment has almost constant covariation scores. Statistical significance could not be
        assessed; the significant-pair count is not reported as zero.
      </p>
      <p v-else>
        {{ covariation.counts?.significant_pairs ?? "Not reported" }} significant pairs across
        {{ covariation.counts?.tested_pairs ?? "Not reported" }} pair tests (E-value ≤ 0.05).
      </p>
      <p>
        R-scape tests all alignment-column pairs without using the RNAalifold fold as a prior.
        Pair-level power estimates are reported for significant pairs. Whole-family power is not
        estimated; zero significant pairs does not establish lack of structure or RNA activity.
      </p>
      <div
        v-if="covariation.pairs?.length"
        class="table-scroll"
      >
        <table>
          <thead>
            <tr>
              <th>Alignment columns</th>
              <th>E-value</th>
              <th>Inferred substitutions</th>
              <th>Estimated pair power</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pair in covariation.pairs"
              :key="`${pair.left}-${pair.right}`"
            >
              <td>{{ pair.left }}–{{ pair.right }}</td>
              <td>{{ pair.evalue === null ? "Not reported" : pair.evalue.toExponential(3) }}</td>
              <td>{{ pair.substitutions ?? "Not reported" }}</td>
              <td>{{ numeric(pair.power, 2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="covariation.pairs_truncated">
        Download the complete report for all significant pairs.
      </p>
    </template>
    <p v-else>Statistical covariation was not run for this result.</p>
    <h4>Pairing evidence</h4>
    <p>
      Coordinates refer to alignment columns, starting at 1. Pair probabilities describe the model
      ensemble. Compensatory sequence pairs are descriptive counts, not a statistical significance
      test, independent evolutionary events or evidence of RNA activity.
    </p>
    <div
      v-if="pairs.length"
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Columns</th>
            <th>Probability</th>
            <th>Canonical</th>
            <th>Noncanonical</th>
            <th>Gapped</th>
            <th>Compensatory sequence pairs</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="pair in pairs"
            :key="`${pair.left}-${pair.right}`"
          >
            <td>{{ pair.left }}–{{ pair.right }}</td>
            <td>{{ numeric(pair.probability, 3) }}</td>
            <td>{{ pair.canonical_sequences ?? "Not reported" }}</td>
            <td>{{ pair.noncanonical_sequences ?? "Not reported" }}</td>
            <td>{{ pair.gapped_sequences ?? "Not reported" }}</td>
            <td>{{ pair.compensatory_sequence_pairs ?? "Not reported" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>
      {{
        counts.mfe_pairs === 0
          ? "No paired columns were predicted in this consensus structure."
          : "No predicted pairs are shown in this preview."
      }}
    </p>
    <p v-if="pairs.length < counts.mfe_pairs">
      Download the complete report to inspect all predicted pairs.
    </p>
    <p
      v-for="warning in warnings"
      :key="warning"
    >
      {{ warning }}
    </p>
  </section>
</template>

<style scoped>
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
}

.rna-family-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
}
.rna-family-metrics dd {
  margin: 0.25rem 0;
  font-weight: 600;
}
.rna-family-alignment code {
  white-space: pre;
  font-size: 0.9rem;
}
.rna-family-alignment small {
  display: block;
  max-width: 18rem;
  font-weight: normal;
  overflow-wrap: anywhere;
}
</style>
