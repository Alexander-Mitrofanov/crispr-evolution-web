import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisForm } from "../src/App.jsx";

const service = { state: "online", expiresHours: 72 };
const limits = { maxRecords: 20, maxBases: 2_000_000, maxRecordBases: 2_000_000 };

describe("submission policy", () => {
  it("puts operator visibility, capability-token scope, retention, and sensitive-data limits before submit", () => {
    render(<AnalysisForm service={service} limits={limits} onSubmitted={() => {}} />);

    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/service operator/i);
    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/not end-to-end encryption/i);
    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/72 hours after the run finishes/i);
    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/non-sensitive research data only/i);
    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/personal, clinical, controlled, or unpublished sensitive sequences/i);
    expect(screen.getByRole("note", { name: /sequence privacy and retention/i })).toHaveTextContent(/institutionally approved private route/i);
  });

  it("labels the record gate as a public cohort policy and the input as a bounded service", () => {
    render(<AnalysisForm service={service} limits={limits} onSubmitted={() => {}} />);

    expect(screen.getByText(/public-service cohort policy requires 2 records/i)).toBeInTheDocument();
    expect(screen.getByText(/model eligibility still requires at least two comparable detected arrays/i)).toBeInTheDocument();
    expect(screen.getByText(/within bounded public-service limits/i)).toBeInTheDocument();
    expect(screen.getByText(/larger genomes require an institutional batch route/i)).toBeInTheDocument();
  });

  it("states the scope and fallback semantics of deletion-parameter corrections", () => {
    render(<AnalysisForm service={service} limits={limits} onSubmitted={() => {}} />);

    expect(screen.getByText("Deletion-parameter bias corrections")).toBeInTheDocument();
    const explanation = screen.getByText(/refine α\/ρ deletion-parameter estimates/i);
    expect(explanation).toHaveTextContent(/orientation ΔlnL is unchanged/i);
    expect(explanation).toHaveTextContent(/public service/i);
    expect(explanation).toHaveTextContent(/group\/direction-specific ρ correction has no finite fit/i);
    expect(explanation).toHaveTextContent(/records a warning instead of failing the job/i);
    expect(explanation).toHaveTextContent(/IDM\/BDM LRT remain uncorrected/i);
    expect(explanation).toHaveTextContent(/strict all-corrections-or-error is a separate CLI policy/i);
    expect(screen.getByRole("group", { name: "Deletion-parameter bias corrections" })).toBeInTheDocument();
  });

  it("blocks a second submission while a job credential is active", () => {
    render(<AnalysisForm service={service} limits={limits} onSubmitted={() => {}} hasActiveJob/>);
    expect(screen.getByText(/another job is open/i).closest("div")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: /current job still open/i })).toBeDisabled();
  });

  it("rejects an oversized uploaded file before reading it into browser memory", () => {
    const text = vi.fn();
    const file = { name: "too-large.fasta", size: 1_000, text };
    render(<AnalysisForm service={service} limits={{ ...limits, maxRequestBytes: 512 }} onSubmitted={() => {}}/>);
    fireEvent.change(screen.getByLabelText("Upload FASTA file"), { target: { files: [file] } });
    expect(text).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/selected file is/i);
  });

  it("enforces the configured JSON request limit for pasted input", () => {
    render(<AnalysisForm service={service} limits={{ ...limits, maxRequestBytes: 120 }} onSubmitted={() => {}}/>);
    fireEvent.change(screen.getByLabelText(/related contigs or small genomes/i), { target: { value: `>a\n${"A".repeat(80)}` } });
    expect(screen.getByText(/request fits the upload limit/i).closest("li")).toHaveClass("not-ready");
  });
});
