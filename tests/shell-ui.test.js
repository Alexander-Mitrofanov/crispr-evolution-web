import { fireEvent, render, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App.vue";
import { api } from "../src/api.js";
import { ANALYSIS_MODES } from "../src/science.js";

const renderApp = () => {
  vi.spyOn(api, "health").mockResolvedValue({ version: "1.0.0" });
  vi.spyOn(api, "config").mockResolvedValue({ api_version: "1.0.0" });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  return render(App);
};

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("method-first navigation", () => {
  it("shows only the available methods, with no upload form or illustration", () => {
    const { container } = renderApp();
    const picker = screen.getByRole("region", { name: "Choose a method" });
    expect(within(picker).getAllByRole("link")).toHaveLength(ANALYSIS_MODES.length);
    for (const method of ANALYSIS_MODES) {
      expect(within(picker).getByRole("link", { name: method.title })).toHaveAttribute(
        "href",
        `?method=${method.id}`,
      );
    }
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("img", { name: /Genomic locus/i })).not.toBeInTheDocument();
    expect(container.querySelector("footer")).toBeNull();
  });

  it.each(ANALYSIS_MODES)("opens the corresponding upload page for $id", async (method) => {
    renderApp();
    await fireEvent.click(screen.getByRole("link", { name: method.title }));
    expect(screen.getByRole("heading", { level: 1, name: method.title })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Upload FASTA", exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload FASTA file")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Choose a method" })).not.toBeInTheDocument();
    expect(window.location.search).toBe(`?method=${method.id}`);
    expect(Boolean(screen.queryByRole("button", { name: "Load example", exact: true }))).toBe(
      method.id === "orientation",
    );
  });

  it("restores a direct method link and falls back safely for an unknown method", () => {
    window.history.replaceState(null, "", "/?method=cas");
    const { unmount } = renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Find Cas systems" })).toBeInTheDocument();
    unmount();
    window.history.replaceState(null, "", "/?method=unknown");
    renderApp();
    expect(screen.getByRole("heading", { name: "Choose a method" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("preserves method-specific drafts and supports browser Back and Forward", async () => {
    renderApp();
    await fireEvent.click(screen.getByRole("link", { name: /^Find Cas systems/ }));
    await fireEvent.update(screen.getByRole("textbox"), ">cas\nACGT\n");
    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Choose a method" })).toBeInTheDocument(),
    );
    window.history.forward();
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(">cas\nACGT\n"));
    await fireEvent.click(screen.getByRole("button", { name: "All methods" }));
    await fireEvent.click(screen.getByRole("link", { name: /^Detect arrays/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    await fireEvent.click(screen.getByRole("button", { name: "All methods" }));
    await fireEvent.click(screen.getByRole("link", { name: /^Find Cas systems/ }));
    expect(screen.getByRole("textbox")).toHaveValue(">cas\nACGT\n");
  });
});
