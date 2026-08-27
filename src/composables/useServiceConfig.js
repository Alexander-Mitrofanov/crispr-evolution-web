import { onBeforeUnmount, onMounted, ref } from "vue";

import { api } from "../api.js";

const DEFAULT_LIMITS = Object.freeze({
  maxBases: 0,
  maxRecordBases: 0,
  maxRecords: 0,
  maxRequestBytes: 0,
  maxArchiveBytes: 0,
  maxHeaderCharacters: 200,
});

export function useServiceConfig(client = api) {
  const service = ref({ state: "checking", message: "Checking analysis service" });
  const limits = ref({ ...DEFAULT_LIMITS });
  let controller;

  async function refresh() {
    controller?.abort();
    controller = new AbortController();
    if (!client.configured) {
      service.value = { state: "offline", message: "Analysis endpoint not configured" };
      return;
    }
    try {
      const [health, config] = await Promise.all([
        client.health({ signal: controller.signal }),
        client.config({ signal: controller.signal }),
      ]);
      service.value = {
        state: "online",
        message: "Analysis service ready",
        version: health?.version || config?.api_version,
        expiresHours: config?.retention_hours || health?.retention_hours || (config?.retention_seconds ? Math.round(config.retention_seconds / 3600) : null),
      };
      limits.value = {
        maxBases: config?.max_total_bases || config?.max_sequence_bases || health?.max_sequence_bases || 0,
        maxRecordBases: config?.max_record_bases || 0,
        maxRecords: config?.max_records || health?.max_records || 0,
        maxRequestBytes: config?.max_request_bytes || 0,
        maxArchiveBytes: config?.max_archive_bytes || 0,
        maxHeaderCharacters: config?.max_header_characters || 200,
      };
    } catch (error) {
      if (error.name !== "AbortError") {
        service.value = { state: "offline", message: error.message || "The analysis API could not be reached." };
      }
    }
  }

  onMounted(refresh);
  onBeforeUnmount(() => controller?.abort());
  return { service, limits, refresh };
}
