import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/vue";
import RnaFamilyResults from "../src/components/results/RnaFamilyResults.vue";
import { normalizePublicResult } from "../src/features/results/index.js";

describe("R-scape evidence", () => {
  it("keeps absence and uninformative statistics distinct from zero hits", () => {
    const view = render(RnaFamilyResults, {
      props: {
        covariation: {
          available: true,
          status: "uninformative",
          counts: { significant_pairs: null },
        },
      },
    });
    expect(screen.getByText(/Statistical significance could not be assessed/)).toBeVisible();
    expect(screen.queryByText(/0 significant pairs across/)).not.toBeInTheDocument();
    view.unmount();
    render(RnaFamilyResults);
    expect(screen.getByText(/Statistical covariation was not run/)).toBeVisible();
  });
  it("shows significant coordinates, native E-values, and pair-level power", () => {
    render(RnaFamilyResults, {
      props: {
        covariation: {
          available: true,
          status: "completed",
          counts: { significant_pairs: 1, tested_pairs: 780 },
          pairs: [{ left: 2, right: 39, evalue: 0.000002, power: 0.87, substitutions: 48 }],
        },
      },
    });
    expect(screen.getByText("2–39")).toBeVisible();
    expect(screen.getByText("2.000e-6")).toBeVisible();
    expect(screen.getByText(/Whole-family power is not estimated/)).toBeVisible();
  });
  it("normalizes malformed metrics to missing rather than scientific zero", () => {
    const result = normalizePublicResult({
      rna_family: {
        available: true,
        covariation: {
          available: true,
          counts: { significant_pairs: null },
          pairs: [{ left: true, right: 40, evalue: "1e-5", power: 5 }],
        },
      },
    });
    expect(result.rna_family.covariation.counts.significant_pairs).toBeNull();
    expect(result.rna_family.covariation.pairs[0]).toMatchObject({
      left: null,
      evalue: null,
      power: null,
    });
  });
});
