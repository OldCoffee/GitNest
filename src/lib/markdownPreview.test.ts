import { describe, expect, it } from "vitest";
import { isMarkdownPath, sanitizeMarkdownHtml, renderMarkdown } from "../lib/markdownPreview";

describe("markdownPreview", () => {
  it("detects markdown paths", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("docs/Guide.markdown")).toBe(true);
    expect(isMarkdownPath("notes.txt")).toBe(false);
  });

  it("renders headings and links", () => {
    const html = renderMarkdown("# Hello\n\nSee [site](https://example.com).", null);
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("https://example.com");
  });

  it("strips script tags and event handlers", () => {
    const dirty =
      '<p onclick="alert(1)">x</p><script>alert(2)</script><a href="javascript:alert(3)">y</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });
});
