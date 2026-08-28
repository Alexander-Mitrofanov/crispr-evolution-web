import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../src/api.js";
import AnalysisForm from "../src/components/submission/AnalysisForm.vue";

const service = { state: "online", expiresHours: 72 };
const limits = {
  maxRecords: 20,
  maxBases: 2_000_000,
  maxRecordBases: 2_000_000,
  maxRequestBytes: 2_000_000,
  maxHeaderCharacters: 200,
};
const renderForm = (props = {}) => render(AnalysisForm, { props: { service, limits, ...props } });

afterEach(() => vi.restoreAllMocks());

describe("Vue submission policy", () => {
  it("exposes the numbered workflow as a level-three heading hierarchy", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { level: 3, name: /1 Choose the analysis goal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /2 Provide related genomic records/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /3 Review analysis policy/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose the analysis goal" })).toBeInTheDocument();
  });

  it("presents advanced analysis policy as a native disclosure button", async () => {
    renderForm();
    const disclosure = screen.getByText("Advanced analysis policy").closest("summary");
    const details = disclosure.closest("details");

    expect(disclosure.tagName).toBe("SUMMARY");
    expect(details).not.toHaveAttribute("open");
    expect(disclosure).toHaveTextContent(/Show options/i);
    await fireEvent.click(disclosure);
    expect(details).toHaveAttribute("open");
    expect(disclosure).toHaveTextContent(/Hide options/i);
  });

  it("puts operator visibility, token scope, retention, and sensitive-data limits before submit", () => {
    renderForm();
    const notice = screen.getByRole("note", { name: /sequence privacy and retention/i });
    expect(notice).toHaveTextContent(/service operator/i);
    expect(notice).toHaveTextContent(/not end-to-end encryption/i);
    expect(notice).toHaveTextContent(/72 hours after the run finishes/i);
    expect(notice).toHaveTextContent(
      /personal, clinical, controlled, or unpublished sensitive sequences/i,
    );
    expect(notice).toHaveTextContent(/institutionally approved private route/i);
  });

  it("explains the cohort gate, bounded service, and correction fallback", () => {
    renderForm();
    expect(
      screen.getByText(/public-service cohort policy requires 2 records/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/at least two comparable detected arrays/i)).toBeInTheDocument();
    expect(
      screen.getByText(/larger genomes require an institutional batch route/i),
    ).toBeInTheDocument();
    const explanation = screen.getByText(/refine α\/ρ deletion-parameter estimates/i);
    expect(explanation).toHaveTextContent(/orientation ΔlnL is unchanged/i);
    expect(explanation).toHaveTextContent(/records a warning instead of failing the job/i);
    expect(explanation).toHaveTextContent(/strict all-corrections-or-error/i);
  });

  it("blocks a second submission while a credential is active", () => {
    renderForm({ hasActiveJob: true });
    expect(screen.getByText(/another job is open/i).closest("div")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByRole("button", { name: /current job still open/i })).toBeDisabled();
  });

  it("synchronously rejects rapid duplicate submissions", async () => {
    const submitSpy = vi.spyOn(api, "submit").mockReturnValue(new Promise(() => {}));
    renderForm();
    await fireEvent.update(
      screen.getByLabelText(/related contigs or small genomes/i),
      ">a\nACGT\n>b\nACGT\n",
    );
    const form = screen.getByRole("button", { name: /compute/i }).closest("form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized file before reading it", async () => {
    const text = vi.fn();
    renderForm({ limits: { ...limits, maxRequestBytes: 512 } });
    await fireEvent.change(screen.getByLabelText("Upload FASTA file"), {
      target: { files: [{ name: "large.fasta", size: 1_000, text }] },
    });
    expect(text).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/selected file is/i);
  });

  it("enforces the JSON request limit for pasted input", async () => {
    renderForm({ limits: { ...limits, maxRequestBytes: 120 } });
    await fireEvent.update(
      screen.getByLabelText(/related contigs or small genomes/i),
      `>a\n${"A".repeat(80)}`,
    );
    expect(screen.getByText(/request fits the upload limit/i).closest("li")).toHaveClass(
      "not-ready",
    );
  });
});
