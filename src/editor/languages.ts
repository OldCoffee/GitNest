import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { simpleMode } from "@codemirror/legacy-modes/mode/simple-mode";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";

const batch = StreamLanguage.define(
  simpleMode({
    start: [
      { regex: /^\s*(?:rem\b|::).*$/i, token: "comment" },
      { regex: /"(?:[^"]|"")*"/, token: "string" },
      { regex: /%(?:[^%\r\n]+)%|![^!\r\n]+!|%[0-9*~][A-Za-z0-9:~,$.-]*/, token: "variableName" },
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

/** Plain text — editable with no syntax tokens (keeps tab/status language wiring). */
const plainText = StreamLanguage.define(
  simpleMode({
    start: [],
  }),
);

export function languageExtension(path: string): Extension {
  const lower = path.toLowerCase();
  const base = lower.split(/[\\/]/).pop() ?? lower;
  if (lower.endsWith(".java")) return java();
  if (lower.endsWith(".json")) return json();
  if (base === "pom.xml" || lower.endsWith(".xml")) return xml();
  if (lower.endsWith(".css")) return css();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return html();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return markdown();
  if (lower.endsWith(".sql")) return sql();
  if (/\.(?:ya?ml)$/.test(lower)) return StreamLanguage.define(yaml);
  if (lower.endsWith(".properties")) return StreamLanguage.define(properties);
  if (lower.endsWith(".txt")) return plainText;
  if (/\.(?:sh|bash|zsh)$/.test(lower)) return StreamLanguage.define(shell);
  if (/\.(?:bat|cmd)$/.test(lower)) return batch;
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(lower)) {
    return javascript({
      jsx: /\.(jsx|tsx)$/.test(lower),
      typescript: /\.(ts|tsx)$/.test(lower),
    });
  }
  return [];
}
