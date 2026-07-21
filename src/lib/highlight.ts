import type { Highlighter } from "shiki";
import { shikiThemeForUi } from "./theme";
import type { UiTheme } from "./types";

let highlighterPromise: Promise<Highlighter> | null = null;

const LANGS = [
  "javascript",
  "typescript",
  "tsx",
  "json",
  "rust",
  "python",
  "java",
  "kotlin",
  "xml",
  "html",
  "css",
  "markdown",
  "yaml",
  "shell",
  "bat",
  "vue",
  "go",
  "c",
  "cpp",
  "sql",
  "toml",
  "groovy",
  "ruby",
  "php",
  "swift",
  "scala",
  "dockerfile",
  "properties",
] as const;

function getHighlighter() {
  if (!highlighterPromise) {
    // Load shiki lazily so its (large) bundle is not part of the initial app
    // payload. Highlighting is only needed once a file/diff is opened.
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [...LANGS],
      }),
    );
  }
  return highlighterPromise;
}

const EXT_LANG: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "tsx",
  rs: "rust",
  py: "python",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  xml: "xml",
  html: "html",
  htm: "html",
  css: "css",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  bat: "bat",
  cmd: "bat",
  vue: "vue",
  json: "json",
  go: "go",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  sql: "sql",
  toml: "toml",
  gradle: "groovy",
  groovy: "groovy",
  rb: "ruby",
  php: "php",
  swift: "swift",
  scala: "scala",
  properties: "properties",
  txt: "text",
};

export function langFromPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith("dockerfile")) return "dockerfile";
  if ((lower.split(/[\\/]/).pop() ?? lower) === "pom.xml") return "xml";
  const ext = lower.split(".").pop();
  if (!ext) return null;
  return EXT_LANG[ext] ?? null;
}

export async function highlightCode(
  code: string,
  path: string,
  uiTheme: UiTheme = "dark",
): Promise<string | null> {
  const lang = langFromPath(path);
  if (!lang || lang === "text") return null;
  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(code, {
      lang,
      theme: shikiThemeForUi(uiTheme),
    });
  } catch {
    return null;
  }
}

export async function highlightLine(
  line: string,
  path: string,
  uiTheme: UiTheme = "dark",
): Promise<string | null> {
  const lang = langFromPath(path);
  if (!lang || lang === "text" || !line.trim()) return null;
  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(line, {
      lang,
      theme: shikiThemeForUi(uiTheme),
    });
  } catch {
    return null;
  }
}
