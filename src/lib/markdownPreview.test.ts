import { beforeEach, describe, expect, it, vi } from "vitest";

const convertFileSrc = vi.fn((path: string) => `asset://localhost/${path}`);

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => convertFileSrc(path),
}));

import {
  dirname,
  isMarkdownPath,
  joinPath,
  renderMarkdown,
  rewriteMarkdownUrls,
  sanitizeMarkdownHtml,
} from "../lib/markdownPreview";

describe("markdownPreview", () => {
  beforeEach(() => {
    convertFileSrc.mockClear();
    convertFileSrc.mockImplementation((path: string) => `asset://localhost/${path}`);
  });

  it("detects markdown paths", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("docs/Guide.markdown")).toBe(true);
    expect(isMarkdownPath("notes.txt")).toBe(false);
  });

  it("joinPath keeps unix absolute roots and resolves ..", () => {
    expect(dirname("/Users/me/repo/docs/README.md")).toBe("/Users/me/repo/docs");
    expect(dirname("/README.md")).toBe("/");
    expect(joinPath("/Users/me/repo/docs", "./img/a.png")).toBe(
      "/Users/me/repo/docs/img/a.png",
    );
    expect(joinPath("/Users/me/repo/docs", "../assets/x.png")).toBe(
      "/Users/me/repo/assets/x.png",
    );
    expect(joinPath("C:/Users/me/repo/docs", "..\\img\\a.png")).toBe(
      "C:/Users/me/repo/img/a.png",
    );
  });

  it("renders headings, links, and fenced code blocks", () => {
    const html = renderMarkdown(
      "# Hello\n\nSee [site](https://example.com).\n\n```js\nconst x = 1;\n```\n",
      null,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("https://example.com");
    expect(html).toMatch(/<pre[\s\S]*<code[\s\S]*const x = 1/);
  });

  it("strips script tags, event handlers, and javascript: URLs", () => {
    const dirty =
      '<p onclick="alert(1)">x</p><script>alert(2)</script><a href="javascript:alert(3)">y</a>' +
      '<base href="https://evil.test/"><img src="x" onerror="alert(4)">' +
      '<a href="JAVASCRIPT:alert(5)">z</a><a href="vbscript:msgbox(1)">v</a>';
    const clean = sanitizeMarkdownHtml(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/vbscript:/i);
    expect(clean).not.toMatch(/<base/i);
  });

  it("rewrites relative image paths when absoluteFilePath is set", () => {
    const html = renderMarkdown(
      "![logo](./images/logo.png)\n\n![up](../assets/icon.svg)",
      "/Users/me/repo/docs/README.md",
    );
    expect(convertFileSrc).toHaveBeenCalledWith("/Users/me/repo/docs/images/logo.png");
    expect(convertFileSrc).toHaveBeenCalledWith("/Users/me/repo/assets/icon.svg");
    expect(html).toContain('src="asset://localhost//Users/me/repo/docs/images/logo.png"');
    expect(html).toContain('src="asset://localhost//Users/me/repo/assets/icon.svg"');
  });

  it("rewrites absolute local image paths and windows paths", () => {
    expect(
      rewriteMarkdownUrls(
        '<img src="/tmp/shot.png">',
        "/Users/me/repo/README.md",
      ),
    ).toContain('src="asset://localhost//tmp/shot.png"');
    expect(convertFileSrc).toHaveBeenCalledWith("/tmp/shot.png");

    convertFileSrc.mockClear();
    expect(
      rewriteMarkdownUrls(
        '<img src="C:/Users/me/repo/img/a.webp">',
        "C:/Users/me/repo/docs/README.md",
      ),
    ).toContain('src="asset://localhost/C:/Users/me/repo/img/a.webp"');
    expect(convertFileSrc).toHaveBeenCalledWith("C:/Users/me/repo/img/a.webp");
  });

  it("leaves http(s) links and anchors alone", () => {
    const html = renderMarkdown(
      "[web](https://example.com) [mail](mailto:a@b.com) [jump](#section)\n\n![remote](https://cdn.example/a.png)",
      "/Users/me/repo/README.md",
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@b.com"');
    expect(html).toContain('href="#section"');
    expect(html).toContain('src="https://cdn.example/a.png"');
    expect(convertFileSrc).not.toHaveBeenCalled();
  });

  it("does not rewrite when absoluteFilePath is null", () => {
    const html = renderMarkdown("![logo](./logo.png)", null);
    expect(html).toContain('src="./logo.png"');
    expect(convertFileSrc).not.toHaveBeenCalled();
  });
});
