import { fireEvent, render, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import snapshot from "../public/example-result.json";
import { api } from "../src/api.js";
import ResultsView from "../src/components/results/ResultsView.vue";

const credential = { jobId: "0123456789abcdef0123456789abcdef", accessToken: "a".repeat(43), expiresAt: "2099-01-01T00:00:00Z" };
const cloneJob = () => structuredClone(snapshot.job);

afterEach(() => vi.restoreAllMocks());

describe("scientific result contract", () => {
  it("maps navigation to stable scientific section targets", () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    const navigation = screen.getByRole("navigation", { name: "Result sections" });
    for (const [name, target] of [["Synopsis", "#synopsis-heading"], ["Detection", "#category-heading"], ["Preflight", "#preflight-heading"], ["Evidence chain", "#group-map-heading"], ["CRISPR-evOr", "#orientation-heading"], ["SpacerPlacer", "#reconstruction-heading"], ["Provenance", "#provenance-heading"]]) {
      expect(within(navigation).getByRole("link", { name })).toHaveAttribute("href", target);
      expect(document.querySelector(target)).toBeInTheDocument();
    }
  });

  it("keeps detector category primary and never formats raw score as probability", () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    expect(screen.getByText("Raw CRISPRidentify Model score")).toBeInTheDocument();
    expect(screen.getByText(/not a calibrated probability/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/81\.67%/);
  });

  it("shows orientation boundary semantics and both likelihood hypotheses", () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    expect(screen.getByText("1 decisive · 0 unresolved")).toBeInTheDocument();
    expect(screen.getByText(/threshold is an evidence rule/i)).toHaveTextContent(/not a p-value or probability/i);
    expect(screen.getAllByText("Input spacer order").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reversed spacer order").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Delta log likelihood 15\.50/i })).toBeInTheDocument();
  });

  it("connects detector members, canonical repeat, and evolutionary outputs", () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    expect(screen.getAllByText("example_record_01").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Canonical repeat CGGTTCAT/i })).toHaveAttribute("tabindex", "0");
    expect(screen.getAllByText("42 acquisitions · 4 deletions").length).toBeGreaterThan(0);
  });

  it("switches structured input and reverse histories and exposes node events", async () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    const input = screen.getByRole("button", { name: /Input spacer order.*lnL/i });
    const reverse = screen.getByRole("button", { name: /Reversed spacer order.*lnL/i });
    expect(input).toHaveAttribute("aria-pressed", "true");
    await fireEvent.click(reverse);
    expect(reverse).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("45", { selector: ".history-summary strong" })).toBeInTheDocument();
    const node = screen.getAllByRole("button", { name: /Inspect node example_record_04/i })[0];
    await fireEvent.click(node);
    expect(screen.getByText(/Selected reconstructed node/i)).toBeInTheDocument();
  });

  it("never substitutes an available comparison history for a missing supported history", () => {
    const job = cloneJob();
    const comparison = job.summary.orientation.comparisons[0];
    comparison.forward_ln_likelihood_bdm = -39.24813645021139;
    comparison.reverse_ln_likelihood_bdm = -23.745096131593357;
    comparison.forward_minus_reverse_ln_likelihood_bdm = -15.503040318618034;
    comparison.prediction = "Reverse";
    comparison.recommended_reverse = true;
    job.summary.orientation.reconstructions = job.summary.orientation.reconstructions.filter((entry) => entry.hypothesis === "input");

    render(ResultsView, { props: { job, credential } });

    expect(screen.getByText("Reversed spacer order is supported, but its structured reconstruction is unavailable.")).toBeInTheDocument();
    expect(screen.getByText(/available hypothesis is shown for inspection only/i)).toHaveTextContent(/not substituted for the missing reported history/i);
    expect(screen.getByText("Inspection only", { selector: ".history-summary strong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reversed spacer order/i })).toBeDisabled();
    expect(screen.queryByText("Supported history", { selector: ".history-summary strong" })).not.toBeInTheDocument();
  });

  it("loads exact group membership from a sanitized manifest for older jobs", async () => {
    const job = cloneJob();
    const fullGroup = job.summary.adapter.groups[0];
    job.summary.adapter.groups = [{ name: fullGroup.name, array_count: fullGroup.array_count, repeat_key: fullGroup.repeat_key }];
    job.artifacts = [{ artifact_id: "manifest-1", name: "adapter/manifest.json", size_bytes: 900, media_type: "application/json" }];
    const spy = vi.spyOn(api, "downloadArtifact").mockResolvedValue(new Blob([JSON.stringify({ groups: [fullGroup] })], { type: "application/json" }));
    render(ResultsView, { props: { job, credential } });
    await waitFor(() => expect(document.querySelectorAll(".group-member")).toHaveLength(5));
    expect(spy).toHaveBeenCalledWith(credential.jobId, "manifest-1", credential.accessToken, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("surfaces preflight counts, no-deletion caveats, warnings, and tree policy", () => {
    const job = cloneJob();
    job.summary.warnings = [{ code: "rho_bias_fit_unavailable_used_uncorrected", title: "Bias fallback", message: "uncorrected estimates retained" }];
    job.summary.orientation.selected_reconstructions[0]["nb of reconstructed deletions"] = 0;
    render(ResultsView, { props: { job, credential } });
    expect(screen.getByText("Unknown strand excluded")).toBeInTheDocument();
    expect(screen.getByText(/No deletion events were reconstructed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/estimated separately/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Bias fallback")).toBeInTheDocument();
  });

  it("treats no eligible groups as informative success", () => {
    render(ResultsView, { props: { job: { ...cloneJob(), status: "completed_no_eligible_groups" }, credential } });
    expect(screen.getByText("No eligible evolutionary groups")).toBeInTheDocument();
    expect(screen.getByText(/workflow completed successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Which spacer order/i })).not.toBeInTheDocument();
  });

  it("bounds browser buffering and filters empty artifacts", () => {
    const job = cloneJob();
    job.artifacts = [{ artifact_id: "empty", name: "empty.txt", size_bytes: 0 }, { artifact_id: "report", name: "report.txt", size_bytes: 42 }];
    render(ResultsView, { props: { job, credential, maxArchiveBytes: 128 * 1024 * 1024 } });
    expect(screen.getByText(/buffered in this browser tab/i)).toHaveTextContent(/128 MiB/i);
    expect(screen.queryByText("empty.txt")).not.toBeInTheDocument();
    expect(screen.getByText("report.txt")).toBeInTheDocument();
  });
});
