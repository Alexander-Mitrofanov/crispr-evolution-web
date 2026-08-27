import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App.vue";
import { api } from "../src/api.js";
import ResumeJob from "../src/components/jobs/ResumeJob.vue";
import { serializeJobCredential } from "../src/jobStore.js";

const credential = { jobId: "0123456789abcdef0123456789abcdef", accessToken: "a".repeat(43), expiresAt: "2099-01-01T00:00:00Z" };

afterEach(() => vi.restoreAllMocks());

describe("private job recovery", () => {
  it("keeps the file input labelled, described, and bounded", async () => {
    const onResume = vi.fn();
    render(ResumeJob, { props: { onResume } });
    const input = screen.getByLabelText("Choose recovery JSON");
    expect(input).toHaveAttribute("aria-describedby", "resume-description");
    expect(document.getElementById("resume-description")).toHaveTextContent(/Authorization header/i);
    const text = vi.fn();
    input.focus();
    await fireEvent.change(input, { target: { files: [{ name: "large.json", size: 16_385, text }] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/exceeds 16 KiB/i);
    expect(text).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("moves focus to a recovered job after the picker unmounts", async () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.spyOn(api, "health").mockResolvedValue({ version: "1.0.0" });
    vi.spyOn(api, "config").mockResolvedValue({ api_version: "1.0.0" });
    vi.spyOn(api, "getJob").mockResolvedValue({ status: "queued", mode: "orientation" });
    render(App);
    const input = screen.getByLabelText("Choose recovery JSON");
    await fireEvent.change(input, { target: { files: [{ name: "job.recovery.json", size: 512, text: async () => serializeJobCredential(credential) }] } });
    const heading = await screen.findByRole("heading", { name: "Queued" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByText("Already submitted?")).not.toBeInTheDocument();
  });
});
