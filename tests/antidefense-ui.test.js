import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import AntiDefenseContext from "../src/components/results/annotations/AntiDefenseContext.vue";
import { normalizeDefenseContext } from "../src/features/results/model/defenseContext.js";

afterEach(cleanup);
describe("Anti-defense evidence", () => {
  it.each(["not_run", "unavailable", "failed"])("keeps %s distinct from zero", (status) => {
    const normalized = normalizeDefenseContext({ antidefense: { status, counts: null } });
    render(AntiDefenseContext, { props: normalized.antidefense });
    expect(screen.queryByText(/0 candidate systems/)).not.toBeInTheDocument();
    expect(screen.getByText(/do not establish functional inhibition/)).toBeInTheDocument();
    expect(normalized.antidefense.counts.systems).toBeNull();
  });
  it("shows completed scanned-zero and the narrow model scope", () => {
    render(AntiDefenseContext, {
      props: {
        available: true,
        status: "completed",
        counts: { systems: 0, components: 0, hits: 0, genes: 42 },
      },
    });
    expect(screen.getByText(/No modeled anti-defense systems were detected/)).toBeInTheDocument();
    expect(screen.getByText(/Aca_alone identifies associated regulators/)).toBeInTheDocument();
    expect(screen.getByText(/noncommercial research/)).toBeInTheDocument();
  });
  it("does not convert a truncated preview to biological absence", () => {
    render(AntiDefenseContext, {
      props: {
        available: true,
        status: "completed",
        counts: { systems: 3, genes: 62 },
        systemsTruncated: true,
      },
    });
    expect(screen.getByText(/preview is limited/)).toBeInTheDocument();
    expect(screen.queryByText(/No modeled anti-defense systems/)).not.toBeInTheDocument();
  });
  it("retains zero GA and missing numerical evidence separately", () => {
    const row = normalizeDefenseContext({
      antidefense: {
        available: true,
        status: "completed",
        hits: [
          {
            gene_id: "gene1",
            profile: "gam",
            score: 0,
            gathering_threshold: { sequence: 0, domain: 40 },
          },
        ],
      },
    }).antidefense.hits[0];
    expect(row.score).toBe(0);
    expect(row.gatheringThreshold).toEqual({ sequence: 0, domain: 40 });
    expect(row.i_evalue).toBeNull();
  });
});
