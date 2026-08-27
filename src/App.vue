<script setup>
import AnalysisForm from "./components/submission/AnalysisForm.vue";
import JobProgress from "./components/jobs/JobProgress.vue";
import ResumeJob from "./components/jobs/ResumeJob.vue";
import ResultsView from "./components/results/ResultsView.vue";
import HeroHeader from "./components/shell/HeroHeader.vue";
import ReferencesSection from "./components/shell/ReferencesSection.vue";
import ScopeSection from "./components/shell/ScopeSection.vue";
import SiteFooter from "./components/shell/SiteFooter.vue";
import { useJobSession } from "./composables/useJobSession.js";
import { useServiceConfig } from "./composables/useServiceConfig.js";

const { service, limits } = useServiceConfig();
const { credential, job, exampleSnapshot, pollError, cancelling, onSubmitted, onResumed, onExampleLoaded, cancel, forget } = useJobSession();
</script>

<template>
  <div class="site-shell">
    <HeroHeader :service="service"/>
    <main>
      <ResumeJob v-if="!credential" @resume="onResumed"/>
      <AnalysisForm :service="service" :limits="limits" :has-active-job="Boolean(credential)" @submitted="onSubmitted" @example-loaded="onExampleLoaded"/>
      <template v-if="exampleSnapshot"><p class="sr-only" role="status">Precomputed example result ready.</p><div id="example-result" class="example-anchor"><ResultsView :job="exampleSnapshot.job" :example-snapshot="exampleSnapshot"/></div></template>
      <div v-if="credential" id="job-status" class="job-anchor"><JobProgress :job="job || { status: 'queued' }" :credential="credential" :cancelling="cancelling" @cancel="cancel" @forget="forget"/><ResultsView :job="job" :credential="credential" :max-archive-bytes="limits.maxArchiveBytes"/></div>
      <p v-if="pollError" class="poll-error" role="alert">{{ pollError }}</p>
      <ScopeSection/>
      <ReferencesSection/>
    </main>
    <SiteFooter :service="service"/>
  </div>
</template>
