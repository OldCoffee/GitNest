import { describe, expect, it } from "vitest";
import { extension, formatFileSize, isImagePath, previewKindLabel } from "./fileType";

describe("fileType", () => {
  it("parses extensions case-insensitively", () => {
    expect(extension("logo.PNG")).toBe("png");
    expect(extension("archive.tar.gz")).toBe("gz");
    expect(extension(".gitignore")).toBeNull();
    expect(extension("README")).toBeNull();
  });

  it("detects image paths including svg/webp/ico/bmp", () => {
    for (const path of [
      "a.png",
      "b.JPG",
      "c.jpeg",
      "d.gif",
      "e.webp",
      "f.SVG",
      "g.ico",
      "h.bmp",
      "dir/nested/photo.WebP",
    ]) {
      expect(isImagePath(path)).toBe(true);
    }
    expect(isImagePath("readme.md")).toBe(false);
    expect(isImagePath("notes.txt")).toBe(false);
    expect(isImagePath("vector.svgs")).toBe(false);
    expect(isImagePath("photo.png.bak")).toBe(false);
  });

  it("formats sizes and preview labels", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(previewKindLabel("image")).toBe("Image");
  });
});
