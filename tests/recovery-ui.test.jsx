import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { ResumeJob } from "../src/App.jsx";
import { api } from "../src/api.js";
import { serializeJobCredential } from "../src/jobStore.js";

const credential = {
  jobId: "0123456789abcdef0123456789abcdef",
  accessToken: "a".repeat(43),
  expiresAt: "2099-01-01T00:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("private job recovery", () => {
  it("keeps the native file input labelled, described, and locally bounded", async () => {
    const onResume = vi.fn();
    render(<ResumeJob onResume={onResume}/>);

    const input = screen.getByLabelText("Choose recovery JSON");
    expect(input).toHaveAttribute("aria-describedby", "resume-description");
    expect(document.getElementById("resume-description")).toHaveTextContent(/Authorization header/i);

    const text = vi.fn();
    input.focus();
    fireEvent.change(input, { target: { files: [{ name: "large.json", size: 16_385, text }] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/exceeds 16 KiB/i);
    expect(text).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("moves focus to the recovered job instead of dropping it when the picker unmounts", async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    vi.spyOn(api, "getJob").mockResolvedValue({ status: "queued", mode: "orientation" });

    try {
      render(<App/>);
      const input = screen.getByLabelText("Choose recovery JSON");
      input.focus();
      fireEvent.change(input, {
        target: {
          files: [{
            name: "job.recovery.json",
            size: 512,
            text: async () => serializeJobCredential(credential),
          }],
        },
      });

      const heading = await screen.findByRole("heading", { name: "Queued" });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
      expect(screen.queryByText("Already submitted?")).not.toBeInTheDocument();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }
  });
});
