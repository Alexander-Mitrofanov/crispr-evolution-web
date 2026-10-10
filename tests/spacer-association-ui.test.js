import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/vue";
import { api } from "../src/api.js";
import AnalysisForm from "../src/components/submission/AnalysisForm.vue";
import ResultsView from "../src/components/results/ResultsView.vue";
import { normalizePublicResult } from "../src/features/results/index.js";
import fixture from "./fixtures/spacer-association.json";
const service = { state: "online", modes: ["spacer_association"] };
const limits = {
  maxRecords: 1000,
  maxBases: 1000000,
  maxRecordBases: 10000,
  maxRequestBytes: 1000000,
};
afterEach(() => vi.restoreAllMocks());
describe("SpacePHARER", () => {
  it("requires an explicit grouping and a provisioned panel", async () => {
    const submit = vi
      .spyOn(api, "submit")
      .mockResolvedValue({ job_id: "c".repeat(32), access_token: "a".repeat(43) });
    const view = render(AnalysisForm, {
      props: { initialMode: "spacer_association", service, limits },
    });
    const input = screen.getByLabelText("Spacer sequences");
    const button = screen.getByRole("button", { name: "Compute", exact: true });
    await fireEvent.update(input, ">r\nACGT\n");
    expect(button).toBeDisabled();
    await fireEvent.update(screen.getByLabelText("Spacer grouping"), "per_source");
    expect(button).toBeDisabled();
    await fireEvent.update(screen.getByLabelText("Spacer grouping"), "single_set");
    expect(button).toBeEnabled();
    await fireEvent.click(button);
    expect(submit.mock.calls[0][0]).toMatchObject({
      mode: "spacer_association",
      association_grouping: "single_set",
    });
    await fireEvent.update(input, ">long\n" + "A".repeat(201));
    expect(button).toBeDisabled();
    await fireEvent.update(input, ">r\nACGT\n");
    await view.rerender({ service: { state: "online", modes: ["detection"] } });
    expect(button).toBeDisabled();
  });
  it("accepts complete origin annotations only for per-source grouping", async () => {
    render(AnalysisForm, { props: { initialMode: "spacer_association", service, limits } });
    await fireEvent.update(screen.getByLabelText("Spacer grouping"), "per_source");
    const packet = {
      schema: { name: "crisprloci.sequence-set", version: "1.0.0" },
      kind: "spacer",
      molecule: "DNA",
      complete: true,
      records: [
        {
          id: "s1",
          sequence: "ACGT",
          origin: {
            source_id: "contigA",
            source_sha256: "a".repeat(64),
            array_id: "a",
            ordinal: 1,
            start: 1,
            end: 4,
          },
        },
      ],
    };
    await fireEvent.update(screen.getByLabelText("Spacer sequences"), JSON.stringify(packet));
    expect(screen.getByRole("button", { name: "Compute", exact: true })).toBeEnabled();
    delete packet.records[0].origin;
    await fireEvent.update(screen.getByLabelText("Spacer sequences"), JSON.stringify(packet));
    expect(screen.getByRole("button", { name: "Compute", exact: true })).toBeDisabled();
  });
  it("shows actual native candidates and retains missing FDR", async () => {
    render(ResultsView, { props: { job: structuredClone(fixture) } });
    expect(screen.queryByRole("tab", { name: "Arrays", exact: true })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("tab", { name: "Associations", exact: true }));
    const panel = within(screen.getByRole("tabpanel", { name: "Associations", exact: true }));
    expect(panel.getByText("FDR calibration unavailable.")).toBeInTheDocument();
    expect(panel.getByText("source1 → AY369265.2")).toBeInTheDocument();
    expect(panel.getAllByText(/Native FDR: Not reported/)).toHaveLength(2);
    expect(panel.getByText(/at most 100 genomes and 50 Mb/)).toBeInTheDocument();
    const normalized = normalizePublicResult(fixture.summary).spacer_association;
    expect(normalized.associations[0].fdr).toBeNull();
    const doc = structuredClone(fixture.summary);
    doc.spacer_association.associations[0].native_fdr = 0;
    expect(normalizePublicResult(doc).spacer_association.associations[0].fdr).toBeNull();
  });
});
