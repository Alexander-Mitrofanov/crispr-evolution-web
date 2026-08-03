import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Results } from "../src/App.jsx";

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
    },
    orientation: {
      tree_policy: "estimated_separately",
      comparisons: [
        { group: "group_nd", prediction: "ND", decisive: false, confidence_threshold: 5, forward_ln_likelihood_bdm: -12.1, reverse_ln_likelihood_bdm: -15.5, forward_minus_reverse_ln_likelihood_bdm: 3.4 },
        { group: "group_input", prediction: "Forward", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -10, reverse_ln_likelihood_bdm: -17, forward_minus_reverse_ln_likelihood_bdm: 7 },
        { group: "group_reverse", prediction: "Reverse", decisive: true, confidence_threshold: 5, forward_ln_likelihood_bdm: -19, reverse_ln_likelihood_bdm: -11, forward_minus_reverse_ln_likelihood_bdm: -8 },
      ],
      selected_reconstructions: [{
        name: "group_nd",
        "Deletion model preferred by LRT": "BDM",
        ln_lh_bdm: -12.1,
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
    expect(screen.getByText(/per-group threshold shown above/i)).toBeInTheDocument();
    expect(screen.getByText(/not a p-value or probability/i)).toBeInTheDocument();
    expect(screen.getByText("Input order supported")).toBeInTheDocument();
    expect(screen.getByText("Reverse input order supported")).toBeInTheDocument();
    expect(screen.getByText("2 decisive · 1 unresolved")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Delta log likelihood 3\.40.*minus 5 through plus 5 are unresolved/i })).toBeInTheDocument();
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
