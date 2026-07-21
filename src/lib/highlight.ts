import type { Highlighter } from "shiki";
import { shikiThemeForUi } from "./theme";
import type { UiTheme } from "./types";

let highlighterPromise: Promise<Highlighter> | null = null;

/** Languages loaded with the highlighter — keep the initial chunk small. */
const CORE_LANGS = [
  "javascript",
  "typescript",
  "tsx",
  "json",
  "markdown",
  "rust",
  "java",
  "shell",
  "html",
  "css",
  "yaml",
  "toml",
  "xml",
] as const;

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

function getHighlighter() {
  if (!highlighterPromise) {
    // Load shiki lazily so its (large) bundle is not part of the initial app
    // payload. Highlighting is only needed once a file/diff is opened.
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [...CORE_LANGS],
      }),
    );
  }
  return highlighterPromise;
}

async function ensureLanguage(lang: string): Promise<boolean> {
  const highlighter = await getHighlighter();
  if (highlighter.getLoadedLanguages().includes(lang)) {
    return true;
  }
  try {
    await highlighter.loadLanguage(lang as never);
    return true;
  } catch {
    return false;
  }
}

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
    if (!(await ensureLanguage(lang))) return null;
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
    if (!(await ensureLanguage(lang))) return null;
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(line, {
      lang,
      theme: shikiThemeForUi(uiTheme),
    });
  } catch {
    return null;
  }
}
