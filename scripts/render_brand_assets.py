#!/usr/bin/env python3
"""Render committed brand PNG/ICO assets from the local SVG and sharing artwork.

Requires Python Playwright and its Chromium browser, like the browser checks.
Normal frontend builds use the committed assets and need no image tooling.
"""

import argparse
from pathlib import Path
import struct

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    public = root / "public"
    (public / "brand").mkdir(exist_ok=True)
    mark = (public / "favicon.svg").read_text()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
            page.goto((root / "scripts/branding/social-card.html").as_uri())
            page.evaluate("document.fonts.ready")
            page.locator("img").evaluate("image => image.decode()")
            page.screenshot(path=str(public / "brand/social-preview.png"))

            icons = []
            for size in (16, 32, 48, 180):
                page.set_viewport_size({"width": size, "height": size})
                background = "#292b2f" if size == 180 else "transparent"
                page.set_content(
                    f"<style>html,body{{margin:0;background:{background}}}"
                    "svg{display:block;width:100vw;height:100vh}</style>" + mark
                )
                pixels = page.screenshot(omit_background=size != 180)
                if size == 180:
                    (public / "apple-touch-icon.png").write_bytes(pixels)
                else:
                    icons.append((size, pixels))
            # ICO entries contain lossless PNGs at their native browser sizes.
            offset = 6 + 16 * len(icons)
            directory = bytearray(struct.pack("<HHH", 0, 1, len(icons)))
            for size, pixels in icons:
                directory.extend(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(pixels), offset))
                offset += len(pixels)
            (public / "favicon.ico").write_bytes(directory + b"".join(pixels for _, pixels in icons))
        finally:
            browser.close()
    print("Rendered social-preview.png (1200×630), apple-touch-icon.png (180×180), favicon.ico.")


if __name__ == "__main__":
    main()
