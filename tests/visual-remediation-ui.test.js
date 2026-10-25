import { fireEvent, render, screen, within, waitFor } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import AnalysisForm from "../src/components/submission/AnalysisForm.vue";
import ReadinessPanel from "../src/components/submission/ReadinessPanel.vue";
import AncestralHistoryExplorer from "../src/components/results/history/AncestralHistoryExplorer.vue";
import TreeDiagram from "../src/components/results/history/TreeDiagram.vue";
import CatalogTable from "../src/components/catalog/CatalogTable.vue";
import ResultsView from "../src/components/results/ResultsView.vue";
import { inspectFasta } from "../src/fasta.js";
import { ANALYSIS_MODES } from "../src/science.js";
import snapshot from "../public/examples/loci/result.json";

const service = { state: "online", modes: ANALYSIS_MODES.map((mode) => mode.id) };
const limits = {
  maxRecords: 1000,
  maxBases: 2_000_000,
  maxRecordBases: 2_000_000,
  maxRequestBytes: 2_000_000,
};

describe("visual audit behavioral regressions", () => {
  it("keeps invalid options visible after collapsing and links directly to the blocking field", async () => {
    render(AnalysisForm, { props: { initialMode: "detection", service, limits } });
    await fireEvent.update(screen.getByRole("textbox"), ">record\nACGT");
    expect(screen.getByText("Ready to analyze")).toBeInTheDocument();
    const options = screen.getByText("Analysis options").closest("details");
    options.open = true;
    const tool = screen
      .getByText("CRISPRidentify", { selector: ".tool-options-tool strong" })
      .closest("details");
    tool.open = true;
    const field = screen.getByLabelText("Minimum repeat count --min_repeats");
    await fireEvent.update(field, "1");
    options.open = false;
    tool.open = false;
    expect(screen.queryByText("Ready to analyze")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compute", exact: true })).toBeDisabled();
    expect(options.querySelector("summary")).toHaveTextContent("1 invalid option");
    expect(tool.querySelector("summary")).toHaveTextContent("1 invalid");
    await fireEvent.click(
      screen.getByRole("button", { name: "Minimum repeat count: Use 2 or more." }),
    );
    expect(options).toHaveAttribute("open");
    expect(tool).toHaveAttribute("open");
    expect(field).toHaveFocus();
    await fireEvent.update(field, "3");
    expect(screen.getByText("Ready to analyze")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compute", exact: true })).toBeEnabled();
  });

  it.each([
    ["ABC123", "pending"],
    [">duplicate\nACGT\n>duplicate\nACGT", "not-ready"],
    [">a:b\nACGT\n>a/b\nACGT", "not-ready"],
  ])(
    "distinguishes unevaluable syntax from known identifier failures: %s",
    (sequence, expectedClass) => {
      render(ReadinessPanel, {
        props: {
          inspection: inspectFasta(sequence),
          selectedMode: ANALYSIS_MODES[0],
          limits,
          service,
          requestBytes: sequence.length,
          ready: false,
        },
      });
      expect(screen.getByText("Unique record identifiers").closest("li")).toHaveClass(
        expectedClass,
      );
    },
  );

  it("uses RNA family placeholder bases and keeps invalid sequence state after blur", async () => {
    render(AnalysisForm, { props: { initialMode: "rna_family", service, limits } });
    await fireEvent.click(screen.getByRole("radio", { name: /RNA — transcribed/ }));
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("placeholder")).toContain("family_member_A\nACGU");
    expect(input.getAttribute("placeholder")).not.toContain("ACGT");
    await fireEvent.update(input, "ABC123");
    await fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/unsupported RNA symbols/);
  });

  it("makes fallback tree activation reveal full identities and selects only one unnamed node", async () => {
    const { container } = render(AncestralHistoryExplorer, {
      props: {
        summary: {},
        group: "group",
        fallbackTree: "(full_source_identity_with_a_long_suffix_001:0.1,(beta:0.2,gamma:0.3):0.4);",
      },
    });
    expect(container.querySelectorAll("circle.selected")).toHaveLength(0);
    await fireEvent.click(
      screen.getByRole("button", {
        name: "Inspect node full_source_identity_with_a_long_suffix_001",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "full_source_identity_with_a_long_suffix_001",
    );
    const internal = screen.getAllByRole("button", { name: /Inspect node node/ });
    await fireEvent.keyDown(internal[0], { key: "Enter" });
    expect(container.querySelectorAll("circle.selected")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Selected internal node");
    await fireEvent.keyDown(internal[1], { key: " " });
    expect(container.querySelectorAll("circle.selected")).toHaveLength(1);
  });

  it("distinguishes absent branch lengths from reported zero in fallback inspection", async () => {
    render(TreeDiagram, { props: { newick: "(missing,zero:0);" } });
    await fireEvent.click(screen.getByRole("button", { name: "Inspect node missing" }));
    expect(screen.getByRole("status")).toHaveTextContent("Branch length: Not reported");
    await fireEvent.click(screen.getByRole("button", { name: "Inspect node zero" }));
    expect(screen.getByRole("status")).toHaveTextContent("Branch length: 0");
  });

  it("opens database evidence outside table cells and restores focus when closed", async () => {
    render(CatalogTable, {
      props: {
        label: "Cas results",
        columns: [
          ["call_id", "Record"],
          ["gene_evidence", "Evidence", "evidence"],
        ],
        rows: [
          { id: 1, call_id: "record_001", score: null, profile: "Cas9", sequence_id: "contig_001" },
        ],
      },
    });
    const trigger = screen.getByRole("button", { name: "Evidence for record_001" });
    await fireEvent.click(trigger);
    const detail = await screen.findByRole("region", { name: "Evidence for record_001" });
    expect(detail.closest("td")).toBeNull();
    expect(detail).toHaveFocus();
    expect(detail).toHaveTextContent("Caller scoreNot reported");
    expect(detail).toHaveTextContent("Cas9");
    await fireEvent.click(within(detail).getByRole("button", { name: "Close evidence" }));
    expect(trigger).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: "Evidence for record_001" }),
    ).not.toBeInTheDocument();
  });

  it("keeps example downloads in Files and methods, preserving output provenance and warning details", async () => {
    render(ResultsView, { props: { job: snapshot.job, exampleSnapshot: snapshot } });
    expect(
      screen.getByRole("heading", { name: /CRISPR locus annotation results/ }),
    ).toBeInTheDocument();
    const warnings = screen.getByText("3 downloadable artifacts omitted").closest("details");
    expect(warnings).not.toHaveAttribute("open");
    expect(warnings).toHaveTextContent("tracrrna/summary.csv");
    await fireEvent.update(screen.getByRole("combobox", { name: "Result section" }), "files");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Download precomputed output" })).toHaveAttribute(
        "download",
      ),
    );
    expect(screen.getByRole("link", { name: "Download example input" })).toHaveAttribute(
      "href",
      expect.stringContaining("examples/loci/input.fasta"),
    );
  });
});
