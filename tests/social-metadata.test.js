import { describe, expect, it } from "vitest";
import { socialMetadata } from "../scripts/social-metadata.mjs";

const metadata = (url) =>
  Object.fromEntries(
    socialMetadata(url)
      .transformIndexHtml()
      .map(({ attrs }) => [attrs.property || attrs.name, attrs.content]),
  );

describe("static sharing metadata", () => {
  it.each(["https://example.org/", "https://example.org/workbench/"])(
    "resolves crawler image URLs for %s",
    (url) => {
      const tags = metadata(url);
      expect(tags["og:url"]).toBe(url);
      expect(tags["og:image"]).toBe(`${url}brand/social-preview.png`);
      expect(tags["twitter:image"]).toBe(tags["og:image"]);
      expect(tags["og:image:type"]).toBe("image/png");
      expect(tags["og:image:width"]).toBe("1200");
      expect(tags["og:image:height"]).toBe("630");
      expect(tags["og:image:alt"]).toBe(tags["twitter:image:alt"]);
    },
  );

  it("keeps a project path when the configured site has no trailing slash", () => {
    expect(metadata("https://example.org/workbench")["og:image"]).toBe(
      "https://example.org/workbench/brand/social-preview.png",
    );
  });

  it.each([
    "/workbench/",
    "http://example.org/",
    "https://user:secret@example.org/",
    "https://example.org/?token=secret",
    "https://example.org/#job=private",
  ])("rejects non-public or ambiguous site configuration %s", (url) => {
    expect(() => socialMetadata(url)).toThrow(/VITE_SITE_URL/u);
  });
});
