import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import snapshot from "../public/example-result.json";
import { AnalysisForm, Results } from "../src/App.jsx";
import { api } from "../src/api.js";
import { EXAMPLE_FASTA_PATH, EXAMPLE_RESULT_PATH } from "../src/example.js";
import { inspectFasta } from "../src/fasta.js";

const exampleFasta = readFileSync(resolve(process.cwd(), "public", EXAMPLE_FASTA_PATH), "utf8");
const service = { state: "online", expiresHours: 72 };
const limits = { maxRecords: 20, maxBases: 2_000_000, maxRecordBases: 2_000_000, maxHeaderCharacters: 200, maxRequestBytes: 2_000_000 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("one-click reproducible analysis example", () => {
  it("copies the masked input first, then reveals the cached result only after Compute", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      expect(options).toMatchObject({ cache: "no-store", credentials: "omit" });
      if (String(url).endsWith(EXAMPLE_FASTA_PATH)) return { ok: true, text: async () => exampleFasta };
      if (String(url).endsWith(EXAMPLE_RESULT_PATH)) return { ok: true, json: async () => snapshot };
      throw new Error("Unexpected URL");
    });
    vi.stubGlobal("fetch", fetchMock);
    const submitSpy = vi.spyOn(api, "submit");
    const onExampleLoaded = vi.fn();
    const onSubmitted = vi.fn();

    render(<AnalysisForm service={service} limits={limits} onSubmitted={onSubmitted} onExampleLoaded={onExampleLoaded}/>);

    fireEvent.change(screen.getByLabelText(/related contigs or small genomes/i), { target: { value: ">temporary_A\nACGT\n>temporary_B\nACGT\n>temporary_C\nACGT\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Increase spacer edit distance" }));
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    const input = screen.getByLabelText(/related contigs or small genomes/i);
    await waitFor(() => expect(input.value).toBe(exampleFasta));
    expect(onExampleLoaded).toHaveBeenCalledTimes(1);
    expect(onExampleLoaded).toHaveBeenLastCalledWith(null);
    expect(onExampleLoaded).not.toHaveBeenCalledWith(snapshot);
    expect(submitSpy).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(inspectFasta(input.value)).toMatchObject({ valid: true, recordCount: 11, baseCount: 9_598 });
    expect(screen.getByText("masked-example-input.fasta")).toBeInTheDocument();
    expect(document.getElementById("edit-distance")).toHaveTextContent("1");
    expect(screen.getByRole("radio", { name: /Orientation-aware evolution/i })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Compute" }));

    await waitFor(() => expect(onExampleLoaded).toHaveBeenLastCalledWith(snapshot));
    expect(submitSpy).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/api/v1/jobs"))).toBe(true);
  });

  it("uses the real submission path after the loaded example is edited", async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith(EXAMPLE_FASTA_PATH)) return { ok: true, text: async () => exampleFasta };
      return { ok: true, json: async () => snapshot };
    });
    vi.stubGlobal("fetch", fetchMock);
    const submitSpy = vi.spyOn(api, "submit").mockResolvedValue({ job_id: "0123456789abcdef0123456789abcdef", access_token: "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789", status: "queued" });
    const onSubmitted = vi.fn();
    const onExampleLoaded = vi.fn();
    render(<AnalysisForm service={service} limits={limits} onSubmitted={onSubmitted} onExampleLoaded={onExampleLoaded}/>);

    fireEvent.click(screen.getByRole("button", { name: "Run example" }));
    const input = screen.getByLabelText(/related contigs or small genomes/i);
    await waitFor(() => expect(input.value).toBe(exampleFasta));
    fireEvent.change(input, { target: { value: exampleFasta.trimEnd() + "A\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Compute" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(submitSpy).toHaveBeenCalledOnce();
    expect(onExampleLoaded).not.toHaveBeenCalledWith(snapshot);
  });

  it("fails closed before changing the form when either stored asset is not the bound input", async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith(EXAMPLE_FASTA_PATH)) return { ok: true, text: async () => `${exampleFasta}\n` };
      return { ok: true, json: async () => snapshot };
    });
    vi.stubGlobal("fetch", fetchMock);
    const onExampleLoaded = vi.fn();

    render(<AnalysisForm service={service} limits={limits} onSubmitted={vi.fn()} onExampleLoaded={onExampleLoaded}/>);
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    expect(await screen.findByText(/does not match its precomputed result/i)).toBeInTheDocument();
    expect(onExampleLoaded).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/related contigs or small genomes/i)).toHaveValue("");
  });

  it("renders the cached result through the ordinary results view", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Results job={snapshot.job} exampleSnapshot={snapshot}/>);

    expect(screen.getByText("Analysis result")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getAllByText(/example_record_/).length).toBeGreaterThanOrEqual(11);
    expect(screen.getByRole("heading", { name: /What reached the model/i })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Delta log likelihood/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /CRISPRidentify categories/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How the spacer arrays changed/i })).toBeInTheDocument();
    expect(document.querySelector(".example-overview")).not.toBeInTheDocument();
    expect(document.querySelector(".example-export")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Masked example FASTA/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Precomputed result JSON/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download complete result bundle/i })).not.toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key|unique key/i);
  });

  it("hides zero-size artifacts from older live responses", () => {
    const job = {
      ...snapshot.job,
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
