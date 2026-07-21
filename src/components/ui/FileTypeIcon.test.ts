import { describe, expect, it } from "vitest";
import { fileIconKind } from "./FileTypeIcon";

describe("fileIconKind", () => {
  it.each([
    ["src/Main.java", "java"],
    ["Out.class", "class"],
    ["README.md", "markdown"],
    ["pom.xml", "pom"],
    ["config/app.xml", "xml"],
    ["application.yml", "yaml"],
    ["application.properties", "properties"],
    ["notes.txt", "txt"],
    ["App.tsx", "tsx"],
    ["util.ts", "typescript"],
    ["logo.png", "image"],
    ["icon.svg", "svg"],
    ["Dockerfile", "dockerfile"],
    [".gitignore", "git"],
    ["build.gradle", "gradle"],
    ["unknown.foo", "default"],
  ] as const)("%s → %s", (path, kind) => {
    expect(fileIconKind(path)).toBe(kind);
  });

  it("keeps java and class distinct", () => {
    expect(fileIconKind("A.java")).not.toBe(fileIconKind("A.class"));
  });

  it("keeps pom.xml distinct from other xml", () => {
    expect(fileIconKind("pom.xml")).not.toBe(fileIconKind("beans.xml"));
  });
});
