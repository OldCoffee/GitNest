import { describe, expect, it } from "vitest";
import { langFromPath } from "../lib/highlight";
import { hasLanguageSupport, loadLanguageExtension } from "./languages";

const supportedFiles = [
  ["pom.xml", "xml"],
  ["README.md", "markdown"],
  ["build.bat", "bat"],
  ["deploy.sh", "shell"],
  ["schema.sql", "sql"],
  ["settings.json", "json"],
  ["application.yml", "yaml"],
  ["config.yaml", "yaml"],
  ["notes.txt", "text"],
  ["application.properties", "properties"],
] as const;

describe("requested text file language support", () => {
  it.each(supportedFiles)("recognizes %s as %s", (path, language) => {
    expect(langFromPath(path)).toBe(language);
  });

  it.each(supportedFiles)("provides an editor extension for %s", async (path) => {
    expect(hasLanguageSupport(path)).toBe(true);
    await expect(loadLanguageExtension(path)).resolves.not.toEqual([]);
  });
});
