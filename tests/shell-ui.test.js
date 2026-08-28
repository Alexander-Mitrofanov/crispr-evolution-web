import { render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App.vue";
import { api } from "../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("compact application shell", () => {
  it("separates detection from evolutionary analysis and uses the attributed evOr visual", () => {
    vi.spyOn(api, "health").mockResolvedValue({ version: "1.0.0" });
    vi.spyOn(api, "config").mockResolvedValue({ api_version: "1.0.0" });
    render(App);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /CRISPR array detection\. Evolutionary order and orientation\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        /same related CRISPR arrays compared in input and reversed spacer order/i,
      ),
    ).toHaveAttribute("src", expect.stringContaining("evor-orientation.svg"));
    expect(screen.getByText(/Adapted from/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "References" })).toHaveAttribute("href", "#references");
  });

  it("omits the removed scope explainer and footer", () => {
    vi.spyOn(api, "health").mockResolvedValue({ version: "1.0.0" });
    vi.spyOn(api, "config").mockResolvedValue({ api_version: "1.0.0" });
    const { container } = render(App);

    expect(screen.queryByText(/What CRISPR-evOr can—and cannot—tell you/i)).not.toBeInTheDocument();
    expect(container.querySelector("footer")).toBeNull();
  });
});
