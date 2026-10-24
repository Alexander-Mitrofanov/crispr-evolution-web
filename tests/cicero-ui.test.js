import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/vue";
import CiceroResults from "../src/components/results/annotations/CiceroResults.vue";
import { normalizePublicResult } from "../src/features/results/index.js";

describe("CICERO scientific status", () => {
  it("shows unavailable without converting missing predictions to zero", () => {
    const result = normalizePublicResult({
      cicero: { status: "unavailable", predictions: [], prediction_count: 0 },
    });
    expect(result.cicero.predictions).toBeNull();
    expect(result.cicero.prediction_count).toBeNull();
    render(CiceroResults, { props: result.cicero });
    expect(screen.getByText(/Model permissions and CPU validation are pending/)).toBeVisible();
    expect(screen.getByText(/not cleavage or editing success/)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("preserves all ten A/C/G/T probability rows in a future validated result", () => {
    const result = normalizePublicResult({
      cicero: {
        status: "completed",
        available: true,
        prediction_count: 1,
        predictions: [
          {
            id: "cas9-001",
            confidence: 0.6,
            probabilities: Array.from({ length: 10 }, () => [0.1, 0.2, 0.3, 0.4]),
          },
        ],
      },
    });
    render(CiceroResults, { props: result.cicero });
    expect(screen.getByRole("columnheader", { name: "A" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "T" })).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText(/Predicted motif similarity: 0.6000/)).toBeVisible();
  });
  it("normalizes invalid and unnormalized numbers to missing", () => {
    const result = normalizePublicResult({
      cicero: {
        status: "completed",
        available: true,
        prediction_count: 1,
        predictions: [
          {
            id: "cas9-001",
            confidence: "0.9",
            probabilities: Array.from({ length: 10 }, () => [true, 0.2, 0.3, 0.4]),
          },
        ],
      },
    });
    expect(result.cicero.predictions[0].confidence).toBeNull();
    expect(result.cicero.predictions[0].probabilities.every((value) => value === null)).toBe(true);
  });
  it("marks historical results as not run", () => {
    render(CiceroResults);
    expect(screen.getByText(/PAM prediction was not run/)).toBeVisible();
  });
});
