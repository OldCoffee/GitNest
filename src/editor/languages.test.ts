import { describe, expect, it } from "vitest";
import { langFromPath } from "../lib/highlight";
import { languageExtension } from "./languages";

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

  it.each(supportedFiles)("provides an editor extension for %s", (path) => {
    expect(languageExtension(path)).not.toEqual([]);
  });
});
