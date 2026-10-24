import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/vue";
import ProphageContextResults from "../src/components/results/annotations/ProphageContextResults.vue";
import { normalizePublicResult } from "../src/features/results/index.js";

describe("geNomad unavailable status within Phigaro results", () => {
  it("keeps missing classification separate from Phigaro assessed-zero", () => {
    const context = normalizePublicResult({
      prophage_context: {
        available: true,
        counts: { sources: 1, assessed_sources: 1, genes: 1, regions: 0, spacer_matches: 0 },
        genomad: { status: "unavailable", classification_count: 0, classifications: [] },
      },
    }).prophage_context;
    expect(context.genomad.classificationCount).toBeNull();
    expect(context.genomad.classifications).toBeNull();
    expect(context.genomad.provirusCount).toBeNull();
    render(ProphageContextResults, { props: context });
    expect(screen.getByText(/geNomad classification is unavailable/)).toBeVisible();
    expect(
      screen.getByText(/No prophage candidates were reported with the pinned models/),
    ).toBeVisible();
    expect(screen.getByText(/infection, host range or active CRISPR targeting/)).toBeVisible();
  });

  it("shows historical results as not run and rejects unenabled completed claims", () => {
    for (const genomad of [
      undefined,
      { status: "completed", available: true, classifications: [{ score: 1 }] },
    ]) {
      const context = normalizePublicResult({ prophage_context: { genomad } }).prophage_context;
      expect(context.genomad.status).toBe("not_run");
      expect(context.genomad.available).toBe(false);
      expect(context.genomad.classifications).toBeNull();
    }
    render(ProphageContextResults);
    expect(screen.getByText("geNomad classification was not run for this result.")).toBeVisible();
  });
});
