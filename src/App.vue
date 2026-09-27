<script setup>
import { computed, ref } from "vue";
import ModeSelector from "./components/submission/ModeSelector.vue";
import { useAnalysisNavigation } from "./composables/useAnalysisNavigation.js";
import AnalysisForm from "./components/submission/AnalysisForm.vue";
import JobProgress from "./components/jobs/JobProgress.vue";
import ResultsView from "./components/results/ResultsView.vue";
import HeroHeader from "./components/shell/HeroHeader.vue";
import ReferencesSection from "./components/shell/ReferencesSection.vue";
import { useJobSession } from "./composables/useJobSession.js";
import { useServiceConfig } from "./composables/useServiceConfig.js";
import CatalogView from "./components/catalog/CatalogView.vue";

const { service, limits } = useServiceConfig();
const {
  credential,
  job,
  exampleSnapshot,
  pollError,
  cancelling,
  onSubmitted,
  onExampleLoaded,
  cancel,
  forget,
} = useJobSession();
const hasSession = computed(() => Boolean(exampleSnapshot.value || credential.value));
const references = ref(null);
const { method, page, chooseMethod, showMethods, showResults, showDatabase } =
  useAnalysisNavigation(hasSession);

function submitted(nextCredential, initialJob) {
  onSubmitted(nextCredential, initialJob);
  if (page.value !== "database") showResults(true);
}

function exampleLoaded(snapshot) {
  onExampleLoaded(snapshot);
  if (snapshot && page.value !== "database") showResults(true);
}

function leaveJob() {
  forget();
  showMethods();
}
</script>

<template>
  <div class="site-shell">
    <HeroHeader
      :service="service"
      :database-active="page === 'database'"
      @analyze="showMethods"
      @database="showDatabase"
      @references="references?.open()"
    />
    <main
      id="main-content"
      tabindex="-1"
    >
      <button
        v-if="hasSession && page !== 'results'"
        class="session-return"
        type="button"
        @click="showResults"
      >
        Return to current results
      </button>
      <ModeSelector
        v-if="page === 'methods'"
        @select="chooseMethod"
      />
      <KeepAlive>
        <CatalogView v-if="page === 'database'" />
      </KeepAlive>
      <KeepAlive>
        <AnalysisForm
          v-if="page === 'input' && method"
          :key="method"
          :initial-mode="method"
          :service="service"
          :limits="limits"
          :has-active-job="Boolean(credential)"
          @back="showMethods"
          @submitted="submitted"
          @example-loaded="exampleLoaded"
        />
      </KeepAlive>
      <template v-if="exampleSnapshot && page === 'results'"
        ><p
          class="sr-only"
          role="status"
        >
          Precomputed example result ready.
        </p>
        <div
          id="example-result"
          class="example-anchor"
        >
          <ResultsView
            :job="exampleSnapshot.job"
            :example-snapshot="exampleSnapshot"
          /></div
      ></template>
      <div
        v-if="credential && page === 'results'"
        id="job-status"
        class="job-anchor"
      >
        <JobProgress
          :job="job || { status: 'queued' }"
          :credential="credential"
          :cancelling="cancelling"
          @cancel="cancel"
          @forget="leaveJob"
        /><ResultsView
          :job="job"
          :credential="credential"
          :max-archive-bytes="limits.maxArchiveBytes"
        />
      </div>
      <p
        v-if="pollError"
        class="poll-error"
        role="alert"
      >
        {{ pollError }}
      </p>
      <ReferencesSection ref="references" />
    </main>
  </div>
</template>
