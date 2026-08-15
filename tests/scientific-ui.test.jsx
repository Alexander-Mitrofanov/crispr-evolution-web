import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Results } from "../src/App.jsx";
import { api } from "../src/api.js";

const credential = {
  jobId: "job-123",
  accessToken: "private-token",
  expiresAt: "2099-01-01T00:00:00Z",
};

const completedJob = {
  status: "completed",
  options: {
    category_policy: "bona_fide_possible",
    categories: ["Bona-fide", "Possible"],
    spacer_distance: 1,
    bias_corrections_requested: true,
    bias_corrections_effective: true,
    warnings: [],
  },
  summary: {
    detection: {
      category_counts: { "Bona-fide": 2, Possible: 1 },
      arrays: [{
        array_id: "array-1",
        source_id: "isolate_A",
        start: 101,
        end: 420,
        category: "Bona-fide",
        strand: "Forward",
        spacer_count: 7,
        model_score: 0.8732,
      }],
    },
    adapter: {
      emitted_array_count: 3,
      skipped_array_count: 1,
      emitted_group_count: 1,
      unknown_strand_excluded_count: 1,
      skipped_by_reason: { orientation_not_determined: 1 },
      groups: [{
        name: "group_nd",
        array_count: 2,
        repeat_key: "ACGTACGTACGTACGTACGTACGTACGT",
        arrays: [
          { source_id: "isolate_A", array_id: "array-1", category: "Bona-fide", spacer_count: 7, strand: "+", input_sequence_orientation: "source", ccdb_strand: "+" },
          { source_id: "isolate_B", array_id: "array-2", category: "Possible", spacer_count: 6, strand: "+", input_sequence_orientation: "source", ccdb_strand: "+" },
        ],
        arrays_truncated: false,
      }],
    },
    orientation: {
      tree_policy: "estimated_separately",
      trees: [{
        group: "group_nd",
        forward_newick: "(isolate_A:1,isolate_B:1)root:0;",
        reverse_newick: "(isolate_B:1,isolate_A:1)root:0;",
        selected_newick: "(isolate_A:1,isolate_B:1)root:0;",
      }],
      comparisons: [
        { group: "group_nd", prediction: "ND", decisive: false, confidence_threshold: 5, forward_ln_likelihood_bdm: -12.1, reverse_ln_likelihood_bdm: -15.5, forward_minus_reverse_ln_likelihood_bdm: 3.4 },
        { group: "group_input", prediction: "Forward", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -10, reverse_ln_likelihood_bdm: -17, forward_minus_reverse_ln_likelihood_bdm: 7 },
        { group: "group_reverse", prediction: "Reverse", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -19, reverse_ln_likelihood_bdm: -11, forward_minus_reverse_ln_likelihood_bdm: -8 },
      ],
      selected_reconstructions: [{
        name: "group_nd",
        "Deletion model preferred by LRT": "BDM",
        ln_lh_idm: -15.225,
        ln_lh_bdm: -12.1,
        "test_statistic (-2*ln_lh_ratio)": 6.25,
        chi2_quantile: 3.841,
        "nb of reconstructed insertions": 4,
        "nb of reconstructed deletions": 0,
        deletion_rate_bdm: 0.42,
        run_time: 2.5,
      }],
    },
    warnings: [],
  },
};

describe("scientific result labels", () => {
  it("shows detector categories as primary and never converts raw score to a percentage", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getByRole("heading", { name: "CRISPRidentify categories" })).toBeInTheDocument();
    expect(screen.getByText("Raw CRISPRidentify Model score")).toBeInTheDocument();
    expect(screen.getByText("not a calibrated probability", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("0.8732")).toBeInTheDocument();
    expect(screen.queryByText("87.32%")).not.toBeInTheDocument();
  });

  it("labels the unresolved orientation zone and avoids p-value claims", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getAllByText("Unresolved").length).toBeGreaterThan(0);
    expect(screen.getByText(/threshold is an evidence rule/i)).toBeInTheDocument();
    expect(screen.getByText(/not a p-value or probability/i)).toBeInTheDocument();
    expect(screen.getAllByText("Input order supported").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reverse input order supported").length).toBeGreaterThan(0);
    expect(screen.getByText("2 decisive · 1 unresolved")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Delta log likelihood 3\.40.*minus 5 through plus 5 are unresolved/i })).toBeInTheDocument();
    expect(screen.getByText("Distance still needed")).toBeInTheDocument();
  });

  it("visually connects exact detector members, repeat grouping, and evolutionary outputs", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getByRole("heading", { name: "How detections became evolutionary evidence" })).toBeInTheDocument();
    expect(screen.getAllByText("isolate_A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("isolate_B").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Canonical repeat ACGTACGT/i })).toBeInTheDocument();
    expect(screen.getAllByText("4 acquisitions · 0 deletions").length).toBeGreaterThan(0);
  });

  it("loads exact membership from the sanitized manifest for older completed jobs", async () => {
    const inlineGroup = completedJob.summary.adapter.groups[0];
    const downloadSpy = vi.spyOn(api, "downloadArtifact").mockResolvedValue(new Blob([JSON.stringify({ groups: [inlineGroup] })], { type: "application/json" }));
    const job = {
      ...completedJob,
      artifacts: [{ artifact_id: "manifest-1", name: "adapter/manifest.json", size_bytes: 900, media_type: "application/json" }],
      summary: {
        ...completedJob.summary,
        adapter: { ...completedJob.summary.adapter, groups: [{ name: inlineGroup.name, array_count: inlineGroup.array_count, repeat_key: inlineGroup.repeat_key }] },
      },
    };
    render(<Results job={job} credential={credential}/>);
    await waitFor(() => expect(document.querySelectorAll(".group-member")).toHaveLength(2));
    expect(downloadSpy).toHaveBeenCalledWith("job-123", "manifest-1", "private-token", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("renders the selected rooted tree and SpacerPlacer event graphics", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getByRole("img", { name: /Reported input-order SpacerPlacer model tree for group_nd with 2 leaves/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Reconstructed event tally: 4 acquisitions and 0 deletions/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Deletion model likelihood-ratio statistic/i })).toBeInTheDocument();
  });

  it("compares structured input and reverse ancestral histories without a PDF viewer", () => {
    const node = (name, spacers, gains = [], lossBlocks = []) => ({
      name,
      spacers,
      gains,
      loss_blocks: lossBlocks,
      contradictions: [],
      duplications: [],
      rearrangements: [],
      reacquisitions: [],
      independent_gains: [],
      other_duplication_events: [],
    });
    const job = {
      ...completedJob,
      summary: {
        ...completedJob.summary,
        orientation: {
          ...completedJob.summary.orientation,
          comparisons: [{ group: "group_nd", prediction: "Forward", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -12.1, reverse_ln_likelihood_bdm: -20.5, forward_minus_reverse_ln_likelihood_bdm: 8.4 }],
          reconstructions: [
            {
              group: "group_nd",
              hypothesis: "input",
              newick: "(isolate_A:1,isolate_B:1)root:0;",
              spacer_order: [1, 2, 3, 4],
              nodes: [node("root", [1], [1]), node("isolate_A", [1, 2, 3, 4], [2, 3, 4]), node("isolate_B", [1, 2, 3], [], [[4]])],
              acquisition_count: 4,
              deletion_count: 1,
            },
            {
              group: "group_nd",
              hypothesis: "reverse",
              newick: "(isolate_A:0.2,isolate_B:0.2)root:0;",
              spacer_order: [4, 3, 2, 1],
              nodes: [node("root", [1, 2, 3, 4], [1, 2, 3, 4]), node("isolate_A", [1, 2, 3, 4]), node("isolate_B", [1, 2, 3], [], [[4]])],
              acquisition_count: 4,
              deletion_count: 1,
            },
          ],
        },
      },
    };
    render(<Results job={job} credential={credential}/>);
    expect(screen.getByRole("img", { name: /Ancestral reconstruction for group_nd under Input spacer order with 2 observed leaves/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Input spacer order.*supported/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Shared branch scale/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Inferred root root contains 1 reconstructed spacers/i })).toBeInTheDocument();
    expect(screen.getByText(/orientation support does not establish transcription direction/i)).toBeInTheDocument();
    expect(screen.getByText(/not an independent organismal phylogeny/i)).toBeInTheDocument();
  });

  it("does not silently substitute an available history when the supported one is missing", () => {
    const node = (name, spacers, gains = [], lossBlocks = []) => ({
      name,
      spacers,
      gains,
      loss_blocks: lossBlocks,
      contradictions: [],
      duplications: [],
      rearrangements: [],
      reacquisitions: [],
      independent_gains: [],
      other_duplication_events: [],
    });
    const job = {
      ...completedJob,
      summary: {
        ...completedJob.summary,
        orientation: {
          ...completedJob.summary.orientation,
          comparisons: [{ group: "group_nd", prediction: "Reverse", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -20.5, reverse_ln_likelihood_bdm: -12.1, forward_minus_reverse_ln_likelihood_bdm: -8.4 }],
          reconstructions: [{
            group: "group_nd",
            hypothesis: "input",
            newick: "(isolate_A:1,isolate_B:1)root:0;",
            spacer_order: [1, 2],
            nodes: [node("root", [1], [1]), node("isolate_A", [1, 2], [2]), node("isolate_B", [1])],
            acquisition_count: 2,
            deletion_count: 0,
          }],
        },
      },
    };
    render(<Results job={job} credential={credential}/>);
    expect(screen.getByText(/Reversed spacer order is supported, but its structured reconstruction is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Input spacer order.*2 gains/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("reported default")).not.toBeInTheDocument();
  });

  it("surfaces no-deletion caveats and the tree policy", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getByText(/No deletion events were reconstructed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/estimated separately/i).length).toBeGreaterThan(0);
  });

  it("shows exact preflight retention, exclusion, grouping, and unknown-strand counts", () => {
    render(<Results job={completedJob} credential={credential}/>);
    expect(screen.getByText("Unknown strand excluded")).toBeInTheDocument();
    expect(screen.getByText("orientation not determined")).toBeInTheDocument();
  });

  it("renders every per-group fallback when warning codes repeat", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const firstTitle = "CRISPR-evOr bias fallback for group_1 (forward)";
    const secondTitle = "CRISPR-evOr bias fallback for group_2 (reverse)";
    const warning = {
      stage: "crispr_evor",
      code: "rho_bias_fit_unavailable_used_uncorrected",
      message: "rho correction unavailable; uncorrected estimates were retained",
    };

    try {
      render(<Results job={{
        ...completedJob,
        summary: {
          ...completedJob.summary,
          warnings: [
            { ...warning, group: "group_1", orientation: "forward", title: firstTitle },
            { ...warning, group: "group_2", orientation: "reverse", title: secondTitle },
          ],
        },
      }} credential={credential}/>);

      expect(screen.getByText(firstTitle)).toBeInTheDocument();
      expect(screen.getByText(secondTitle)).toBeInTheDocument();
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("treats no eligible evolutionary groups as an informative success", () => {
    render(<Results job={{ ...completedJob, status: "completed_no_eligible_groups" }} credential={credential}/>);
    expect(screen.getByText("No eligible evolutionary groups")).toBeInTheDocument();
    expect(screen.getByText(/workflow completed successfully/i)).toBeInTheDocument();
  });

  it("discloses the bounded browser buffering required for authenticated downloads", () => {
    render(<Results job={completedJob} credential={credential} maxArchiveBytes={128 * 1024 * 1024}/>);
    expect(screen.getByText(/buffered in this browser tab/i)).toHaveTextContent(/128 MiB/i);
    expect(screen.getByRole("note")).toHaveTextContent(/complete ZIP not available/i);
    expect(screen.queryByRole("button", { name: /download complete result bundle/i })).not.toBeInTheDocument();
  });
});
