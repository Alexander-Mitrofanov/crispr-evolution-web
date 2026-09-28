<script setup>
import { computed } from "vue";

import { readableBytes, formatNumber } from "../../utils/formatting.js";
import { analysisModeAvailable } from "../../science.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({
  inspection: { type: Object, required: true },
  selectedMode: { type: Object, required: true },
  limits: { type: Object, required: true },
  service: { type: Object, required: true },
  requestBytes: { type: Number, required: true },
  molecule: { type: String, default: "DNA" },
});

const checks = computed(() => {
  const { inspection, selectedMode, limits, service, requestBytes } = props;
  const unique =
    inspection.records.length ===
    new Set(inspection.records.map((record) => record.identifier)).size;
  const withinRecords = !limits.maxRecords || inspection.recordCount <= limits.maxRecords;
  const withinBases = !limits.maxBases || inspection.baseCount <= limits.maxBases;
  const withinRecordBases =
    !limits.maxRecordBases ||
    inspection.records.every((record) => record.sequence.length <= limits.maxRecordBases);
  const withinRequest = !limits.maxRequestBytes || requestBytes <= limits.maxRequestBytes;
  return [
    {
      ok: inspection.valid,
      label: inspection.valid ? `Valid IUPAC ${props.molecule} FASTA` : "Valid FASTA required",
      detail: inspection.errors[0],
    },
    { ok: inspection.valid && unique, label: "Unique record identifiers" },
    {
      ok: inspection.recordCount >= selectedMode.minimumRecords,
      label: `${inspection.recordCount || 0} of ${selectedMode.minimumRecords} required input records`,
      detail:
        selectedMode.minimumRecords === 1
          ? "This analysis accepts one or more records."
          : `This public-service cohort policy requires ${selectedMode.minimumRecords} records; model eligibility still requires at least two comparable detected arrays.`,
    },
    ...(selectedMode.id === "orientation"
      ? [
          {
            ok: inspection.recordCount >= 3,
            recommended: true,
            label: "3+ isolate records recommended",
            detail:
              inspection.recordCount < 3
                ? "Three or more related isolate records usually provide a more informative comparison."
                : null,
          },
        ]
      : []),
    {
      ok: withinRecords && withinBases && withinRecordBases,
      label: "Within bounded public-service limits",
      detail: !withinRecords
        ? `Limit: ${limits.maxRecords} records`
        : !withinBases
          ? `Limit: ${formatNumber(limits.maxBases)} total bases`
          : !withinRecordBases
            ? `Limit: ${formatNumber(limits.maxRecordBases)} bases per record`
            : limits.maxBases
              ? `Configured cap: ${formatNumber(limits.maxBases)} total bases. Larger genomes require an institutional batch route.`
              : null,
    },
    {
      ok: withinRequest,
      label: "Request fits the upload limit",
      detail: !withinRequest
        ? `Request: ${readableBytes(requestBytes)}; limit: ${readableBytes(limits.maxRequestBytes)}.`
        : null,
    },
    {
      ok: service.state === "online",
      label: "Analysis service available",
      detail: service.state === "offline" ? service.message : null,
    },
    ...(selectedMode.requiresAdvertisement
      ? [
          {
            ok: analysisModeAvailable(selectedMode.id, service),
            label: analysisModeAvailable(selectedMode.id, service)
              ? "Reference spacer search available"
              : "Reference spacer search unavailable on this service",
            detail:
              "The service must advertise an installed reference collection before submission.",
          },
        ]
      : []),
  ];
});
</script>

<template>
  <details class="readiness">
    <summary>
      <span>{{
        !inspection.recordCount
          ? "Input requirements"
          : checks.every((item) => item.ok || item.recommended)
            ? "Ready to analyze"
            : "Review input requirements"
      }}</span>
      <small
        >{{ selectedMode.minimumRecords }}+
        {{ selectedMode.minimumRecords === 1 ? "record" : "related records"
        }}<template v-if="limits.maxBases">
          · {{ formatNumber(limits.maxBases) }} bases max</template
        ></small
      >
    </summary>
    <ul>
      <li
        v-for="item in checks"
        :key="item.label"
        :class="item.ok ? 'ready' : item.recommended ? 'recommended' : 'not-ready'"
      >
        <span class="check-icon"
          ><AppIcon
            :name="item.ok ? 'check' : item.recommended ? 'info' : 'warning'"
            :size="15" /></span
        ><span
          >{{ item.label }}<small v-if="item.detail">{{ item.detail }}</small></span
        >
      </li>
    </ul>
    <p
      v-if="service.expiresHours"
      class="retention-note"
    >
      <AppIcon
        name="info"
        :size="16"
      />
      Results and credentials expire after {{ service.expiresHours }} hours.
    </p>
  </details>
</template>
