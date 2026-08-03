import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import snapshot from "../public/example-klebsiella-g768-reference-v1.json";
import { EXAMPLE_RESULT_PATH } from "../src/example.js";
import { AnalysisForm, ExampleOverview, Results } from "../src/App.jsx";

const service = { state: "online", expiresHours: 72 };
const limits = { maxRecords: 20, maxBases: 2_000_000, maxRecordBases: 2_000_000, maxHeaderCharacters: 200, maxRequestBytes: 2_000_000 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("instant reference-only biological example", () => {
  it("fetches exactly one JSON snapshot and leaves an empty form untouched", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      expect(options?.method || "GET").toBe("GET");
      expect(String(url)).toContain(EXAMPLE_RESULT_PATH);
      expect(String(url)).not.toMatch(/\.fa|\.fasta|jobs/i);
      return { ok: true, json: async () => snapshot };
    });
    vi.stubGlobal("fetch", fetchMock);
    const onExampleLoaded = vi.fn();

    render(<AnalysisForm
      service={service}
      limits={limits}
      onSubmitted={vi.fn()}
      onExampleLoaded={onExampleLoaded}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Explore Klebsiella publication cohort" }));

    await waitFor(() => expect(onExampleLoaded).toHaveBeenCalledWith(snapshot));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/related contigs or small genomes/i)).toHaveValue("");
    expect(screen.getByText("No file selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit analysis" })).toBeDisabled();
  });

  it("does not overwrite pre-existing user input or options", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => snapshot }));
    vi.stubGlobal("fetch", fetchMock);
    const userInput = ">own_A\nACGT\n>own_B\nACGT\n>own_C\nACGT\n";

    render(<AnalysisForm
      service={service}
      limits={limits}
      onSubmitted={vi.fn()}
      onExampleLoaded={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText(/related contigs or small genomes/i), { target: { value: userInput } });
    fireEvent.click(screen.getByRole("button", { name: "Increase spacer edit distance" }));
    expect(document.getElementById("edit-distance")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "Explore Klebsiella publication cohort" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText(/related contigs or small genomes/i)).toHaveValue(userInput);
    expect(document.getElementById("edit-distance")).toHaveTextContent("2");
  });

  it("renders all four tool stages, all 12 references, and no sequence download", () => {
    const close = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<>
      <ExampleOverview snapshot={snapshot} onClose={close}/>
      <Results job={snapshot.result} exampleSnapshot={snapshot}/>
    </>);

    expect(screen.getByText(/Precomputed result · no job submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Genome references only · no nucleotide sequence hosted/i)).toBeInTheDocument();
    expect(screen.getByRole("note", { name: /real biological data and subset-size explanation/i })).toHaveTextContent(/12/);
    expect(screen.getByText("12 arrays detected")).toBeInTheDocument();
    expect(screen.getByText("7 arrays in 2 comparable groups")).toBeInTheDocument();
    expect(screen.getByText(/13 gains · 5 losses · 0 duplications/i)).toBeInTheDocument();
    expect(screen.getAllByText("1 decisive · 1 unresolved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /CRISPRidentify categories/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ancestral spacer history/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CP025633.1" })).toHaveAttribute("href", "https://www.ncbi.nlm.nih.gov/nuccore/CP025633.1");
    expect(screen.getAllByRole("link").filter((link) => /^CP|^LR/.test(link.textContent || ""))).toHaveLength(12);
    expect(screen.getByRole("link", { name: /Sanitized result JSON/i })).toBeInTheDocument();
    expect(screen.queryByText(/Example FASTA|Download example FASTA|Run these loci|loaded FASTA/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download complete result bundle/i })).not.toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key|unique key/i);

    fireEvent.click(screen.getByRole("button", { name: "Close example result" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("hides zero-size artifacts from older live responses", () => {
    const job = {
      ...snapshot.result,
      artifacts: [
        { artifact_id: "empty", name: "empty.txt", size_bytes: 0, media_type: "text/plain" },
        { artifact_id: "nonempty", name: "report.txt", size_bytes: 42, media_type: "text/plain" },
      ],
    };

    render(<Results job={job} credential={{ jobId: "job1", accessToken: "token" }} maxArchiveBytes={1000}/>);

    expect(screen.queryByText("empty.txt")).not.toBeInTheDocument();
    expect(screen.getByText("report.txt")).toBeInTheDocument();
  });
});
