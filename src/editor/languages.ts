import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";

type LangLoader = () => Promise<Extension>;

const batchLoader: LangLoader = async () => {
  const { simpleMode } = await import("@codemirror/legacy-modes/mode/simple-mode");
  return StreamLanguage.define(
    simpleMode({
      start: [
        { regex: /^\s*(?:rem\b|::).*$/i, token: "comment" },
        { regex: /"(?:[^"]|"")*"/, token: "string" },
        {
          regex: /%(?:[^%\r\n]+)%|![^!\r\n]+!|%[0-9*~][A-Za-z0-9:~,$.-]*/,
          token: "variableName",
        },
        {
          regex:
            /\b(?:if|else|for|in|do|goto|call|exit|set|setlocal|endlocal|shift|start|title|echo|pause|choice|errorlevel|exist|defined|not|cmd|pushd|popd)\b/i,
          token: "keyword",
        },
        { regex: /&&|\|\||[|&<>^]/, token: "operator" },
        { regex: /:[A-Za-z0-9_.-]+/, token: "labelName" },
        { regex: /\b\d+\b/, token: "number" },
      ],
      languageData: {
        commentTokens: { line: "REM " },
      },
    }),
  );
};

const plainTextLoader: LangLoader = async () => {
  const { simpleMode } = await import("@codemirror/legacy-modes/mode/simple-mode");
  return StreamLanguage.define(simpleMode({ start: [] }));
};

function resolveLoader(path: string): LangLoader | null {
  const lower = path.toLowerCase();
  const base = lower.split(/[\\/]/).pop() ?? lower;
  if (lower.endsWith(".java")) {
    return async () => {
      const { java } = await import("@codemirror/lang-java");
      return java();
    };
  }
  if (lower.endsWith(".json")) {
    return async () => {
      const { json } = await import("@codemirror/lang-json");
      return json();
    };
  }
  if (base === "pom.xml" || lower.endsWith(".xml")) {
    return async () => {
      const { xml } = await import("@codemirror/lang-xml");
      return xml();
    };
  }
  if (lower.endsWith(".css")) {
    return async () => {
      const { css } = await import("@codemirror/lang-css");
      return css();
    };
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return async () => {
      const { html } = await import("@codemirror/lang-html");
      return html();
    };
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return async () => {
      const { markdown } = await import("@codemirror/lang-markdown");
      return markdown();
    };
  }
  if (lower.endsWith(".sql")) {
    return async () => {
      const { sql } = await import("@codemirror/lang-sql");
      return sql();
    };
  }
  if (/\.(?:ya?ml)$/.test(lower)) {
    return async () => {
      const { yaml } = await import("@codemirror/legacy-modes/mode/yaml");
      return StreamLanguage.define(yaml);
    };
  }
  if (lower.endsWith(".properties")) {
    return async () => {
      const { properties } = await import("@codemirror/legacy-modes/mode/properties");
      return StreamLanguage.define(properties);
    };
  }
  if (lower.endsWith(".txt")) return plainTextLoader;
  if (/\.(?:sh|bash|zsh)$/.test(lower)) {
    return async () => {
      const { shell } = await import("@codemirror/legacy-modes/mode/shell");
      return StreamLanguage.define(shell);
    };
  }
  if (/\.(?:bat|cmd)$/.test(lower)) return batchLoader;
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(lower)) {
    return async () => {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({
        jsx: /\.(jsx|tsx)$/.test(lower),
        typescript: /\.(ts|tsx)$/.test(lower),
      });
    };
  }
  return null;
}

/** True when the path maps to a known editor language pack. */
export function hasLanguageSupport(path: string): boolean {
  return resolveLoader(path) != null;
}

/**
 * Lazily load the CodeMirror language pack for `path`.
 * Keeps `@codemirror/lang-*` out of the initial app chunk.
 */
export async function loadLanguageExtension(
  path: string,
): Promise<Extension | Extension[]> {
  const loader = resolveLoader(path);
  if (!loader) return [];
  return loader();
}
