import { render, screen, within } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import ResultsView from "../src/components/results/ResultsView.vue";
import { cloneResultJob, resultCredential } from "./support/resultFixture.js";

describe("scientific result overview", () => {
  it("maps navigation to stable scientific section targets", () => {
    render(ResultsView, { props: { job: cloneResultJob(), credential: resultCredential } });
    const navigation = screen.getByRole("navigation", { name: "Result sections" });
    for (const [name, target] of [
      ["Synopsis", "#synopsis-heading"],
      ["Detection", "#category-heading"],
      ["Preflight", "#preflight-heading"],
      ["Evidence chain", "#group-map-heading"],
      ["CRISPR-evOr", "#orientation-heading"],
      ["SpacerPlacer", "#reconstruction-heading"],
      ["Provenance", "#provenance-heading"],
    ]) {
      expect(within(navigation).getByRole("link", { name })).toHaveAttribute("href", target);
      expect(document.querySelector(target)).toBeInTheDocument();
    }
  });

  it("keeps detector category primary and never formats raw score as probability", () => {
    render(ResultsView, { props: { job: cloneResultJob(), credential: resultCredential } });
    expect(screen.getByText("Raw CRISPRidentify Model score")).toBeInTheDocument();
    expect(screen.getByText(/not a calibrated probability/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/81\.67%/);
  });

  it("connects detector members, canonical repeat, and evolutionary outputs", () => {
    render(ResultsView, { props: { job: cloneResultJob(), credential: resultCredential } });
    expect(screen.getAllByText("example_record_01").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Canonical repeat CGGTTCAT/i })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getAllByText("42 acquisitions · 4 deletions").length).toBeGreaterThan(0);
  });

  it("surfaces preflight counts, no-deletion caveats, warnings, and tree policy", () => {
    const job = cloneResultJob();
    job.summary.warnings = [
      {
        code: "rho_bias_fit_unavailable_used_uncorrected",
        title: "Bias fallback",
        message: "uncorrected estimates retained",
      },
    ];
    job.summary.orientation.selected_reconstructions[0]["nb of reconstructed deletions"] = 0;
    render(ResultsView, { props: { job, credential: resultCredential } });
    expect(screen.getByText("Unknown strand excluded")).toBeInTheDocument();
    expect(screen.getByText(/No deletion events were reconstructed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/estimated separately/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Bias fallback")).toBeInTheDocument();
  });

  it("treats no eligible groups as informative success", () => {
    render(ResultsView, {
      props: {
        job: { ...cloneResultJob(), status: "completed_no_eligible_groups" },
        credential: resultCredential,
      },
    });
    expect(screen.getByText("No eligible evolutionary groups")).toBeInTheDocument();
    expect(screen.getByText(/workflow completed successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Which spacer order/i })).not.toBeInTheDocument();
  });
});
