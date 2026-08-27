import { fireEvent, render, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import snapshot from "../public/example-result.json";
import { api } from "../src/api.js";
import ResultsView from "../src/components/results/ResultsView.vue";
import { sanitizeAdapterMembership } from "../src/utils/results.js";

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
    const orientationPlot = screen.getByRole("img", { name: /Delta log likelihood 15\.50/i });
    expect(orientationPlot.tagName.toLowerCase()).toBe("svg");
    expect(Number(orientationPlot.querySelector(".orientation-marker").getAttribute("x1"))).toBeGreaterThan(50);
    const eventRibbon = screen.getByRole("img", { name: "42 acquisitions and 4 deletions" });
    expect(Number(eventRibbon.querySelector(".event-ribbon-gains").getAttribute("width"))).toBeCloseTo(42 / 46 * 100, 5);
    expect(Number(eventRibbon.querySelector(".event-ribbon-losses").getAttribute("width"))).toBeCloseTo(4 / 46 * 100, 5);
    const modelGauge = screen.getByRole("img", { name: /likelihood-ratio statistic 0, cutoff 3\.841.*Preferred model IDM/i });
    expect(modelGauge.querySelector("svg")).toBeInTheDocument();
    expect(modelGauge.querySelector(".model-value")).toHaveAttribute("x1", "0");
    expect(Number(modelGauge.querySelector(".model-cutoff").getAttribute("x1"))).toBeGreaterThan(60);
    expect(screen.getByText("LRT statistic").parentElement).toHaveTextContent("0");
    expect(screen.getByText("IDM lnL").parentElement).toHaveTextContent("−23.745".replace("−", "-"));
    expect(document.querySelectorAll("[style]")).toHaveLength(0);
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
    expect(document.querySelector(".ancestor-state strong")).toHaveTextContent("example_record_04");
    expect(screen.getByText("Comparison history", { selector: ".history-summary strong" })).toBeInTheDocument();
  });

  it("preserves topology, canvas, exact-branch, and loss-count inspection", async () => {
    render(ResultsView, { props: { job: cloneJob(), credential } });
    const topology = screen.getByRole("button", { name: "Readable topology" });
    const branchScale = screen.getByRole("button", { name: "Shared branch scale" });
    expect(topology).toHaveAttribute("aria-pressed", "true");
    const branchNode = screen.getAllByRole("button", { name: /Inspect node example_record_03/i })[0];
    const topologyX = Number(branchNode.querySelector("circle").getAttribute("cx"));
    await fireEvent.click(branchScale);
    expect(branchScale).toHaveAttribute("aria-pressed", "true");
    expect(Number(branchNode.querySelector("circle").getAttribute("cx"))).not.toBe(topologyX);

    await fireEvent.click(screen.getByRole("button", { name: "Fit overview" }));
    expect(document.querySelector(".history-canvas")).toHaveClass("is-fit");
    await fireEvent.click(branchNode);
    expect(document.querySelector(".ancestor-state small")).toHaveTextContent("−3 losses");

    await fireEvent.click(screen.getByText("Exact node and branch data"));
    expect(screen.getByRole("columnheader", { name: "Parent" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Branch length" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /example_record_03.*Inner3.*Observed leaf.*0\.00049/i })).toBeInTheDocument();
  });

  it("exposes every special-event category in exact node data", async () => {
    const job = cloneJob();
    const root = job.summary.orientation.reconstructions.find((entry) => entry.hypothesis === "input").nodes.find((node) => node.name === "Inner4");
    Object.assign(root, { contradictions: [7], duplications: [8], rearrangements: [9], reacquisitions: [10], independent_gains: [11], other_duplication_events: [12] });
    render(ResultsView, { props: { job, credential } });
    await fireEvent.click(screen.getByText("Exact node and branch data"));
    const rootRow = screen.getByRole("row", { name: /Inner4.*Inferred root/i });
    expect(rootRow).toHaveTextContent("contradictions: 7");
    expect(rootRow).toHaveTextContent("duplications: 8");
    expect(rootRow).toHaveTextContent("rearrangements: 9");
    expect(rootRow).toHaveTextContent("reacquisitions: 10");
    expect(rootRow).toHaveTextContent("independent gains: 11");
    expect(rootRow).toHaveTextContent("other duplications: 12");
  });

  it("keeps absent reconstruction metrics absent and accepts documented aliases", () => {
    const missingJob = cloneJob();
    const missing = missingJob.summary.orientation.selected_reconstructions[0];
    for (const key of ["nb of reconstructed insertions", "nb of reconstructed deletions", "nb of unique spacers", "nb of spacers in alignment", "nb of unique spacer arrays", "nb of leafs (after combining non-uniques)", "test_statistic (-2*ln_lh_ratio)", "chi2_quantile", "ln_lh_idm", "ln_lh_bdm", "Deletion model preferred by LRT", "nb of reconstructed duplications", "nb of reconstructed rearrangements", "nb of reconstructed reacquisitions", "nb of reconstructed independent gains"]) delete missing[key];
    const { unmount } = render(ResultsView, { props: { job: missingJob, credential } });
    expect(document.querySelector(".spacerplacer-verdict strong")).toHaveTextContent("— acquisitions · — deletions");
    expect(document.querySelector(".event-graphic .model-unavailable")).toHaveTextContent("totals were not reported");
    expect(document.querySelector(".model-selection .model-unavailable")).toHaveTextContent("Likelihood-ratio statistic not reported");
    expect(document.querySelector(".event-ribbon")).not.toBeInTheDocument();
    unmount();

    const aliasJob = cloneJob();
    const alias = aliasJob.summary.orientation.selected_reconstructions[0];
    for (const key of ["nb of reconstructed insertions", "nb of reconstructed deletions", "nb of unique spacers", "nb of spacers in alignment", "nb of unique spacer arrays", "nb of leafs (after combining non-uniques)", "test_statistic (-2*ln_lh_ratio)", "chi2_quantile", "ln_lh_idm", "ln_lh_bdm", "Deletion model preferred by LRT"]) delete alias[key];
    Object.assign(alias, { gains: 7, losses: 2, unique_spacers: 9, aligned_spacers: 10, unique_arrays: 3, leaf_count: 4, likelihood_ratio_statistic: 6, model_selection_cutoff: 3, idm_log_likelihood: -10, log_likelihood: -7, preferred_model: "BDM" });
    render(ResultsView, { props: { job: aliasJob, credential } });
    expect(document.querySelector(".spacerplacer-verdict strong")).toHaveTextContent("7 acquisitions · 2 deletions");
    expect(screen.getByRole("img", { name: "7 acquisitions and 2 deletions" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /likelihood-ratio statistic 6, cutoff 3.*Preferred model BDM/i })).toBeInTheDocument();
    expect(document.querySelector(".inventory-counts")).toHaveTextContent("10 aligned positions");
  });

  it("caps oversized histories and falls back for malformed structured trees", () => {
    const oversizedJob = cloneJob();
    const input = oversizedJob.summary.orientation.reconstructions.find((entry) => entry.hypothesis === "input");
    const leaves = Array.from({ length: 41 }, (_, index) => `leaf_${index + 1}`);
    input.newick = `(${leaves.map((name) => `${name}:0.1`).join(",")})Root:0;`;
    input.nodes = [{ name: "Root", spacers: [], gains: [], loss_blocks: [] }, ...leaves.map((name) => ({ name, spacers: [], gains: [], loss_blocks: [] }))];
    const { unmount } = render(ResultsView, { props: { job: oversizedJob, credential } });
    expect(screen.getByText("Structured history available in the result bundle")).toBeInTheDocument();
    expect(screen.getByText(/inline browser is capped at 40 leaves and 120 nodes/i)).toBeInTheDocument();
    unmount();

    const malformedJob = cloneJob();
    malformedJob.summary.orientation.reconstructions.find((entry) => entry.hypothesis === "input").newick = "(not-valid";
    render(ResultsView, { props: { job: malformedJob, credential } });
    expect(screen.getByRole("img", { name: /Supported history model tree.*repeat_cfad14d7184c_group_001/i })).toBeInTheDocument();
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

  it("preserves bounded orientation provenance from adapter manifests", () => {
    const groups = sanitizeAdapterMembership({ groups: [{ name: "group", arrays: [{ source_id: "source", array_id: "array", category: "Bona-fide", spacer_count: 4, strand: "-", input_sequence_orientation: "source", ccdb_strand: "+" }] }] });
    expect(groups[0].arrays[0]).toMatchObject({ input_sequence_orientation: "source", ccdb_strand: "+" });
    const bounded = sanitizeAdapterMembership({ groups: [{ name: "group", arrays: [{ input_sequence_orientation: "x".repeat(100), ccdb_strand: "y".repeat(100) }] }] });
    expect(bounded[0].arrays[0].input_sequence_orientation).toHaveLength(32);
    expect(bounded[0].arrays[0].ccdb_strand).toHaveLength(32);
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
