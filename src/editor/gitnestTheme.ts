import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** Graphite + precision-blue editor chrome (no oneDark purple). */
function chromeTheme(dark: boolean) {
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--jb-bg)",
        color: "var(--jb-text)",
        height: "100%",
      },
      ".cm-content": {
        caretColor: "var(--jb-accent)",
        fontFamily: "var(--jb-mono)",
        fontSize: "13px",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--jb-accent)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--jb-selection) !important",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--jb-hover-overlay)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--jb-panel)",
        color: "var(--jb-text-dim)",
        border: "none",
        borderRight: "1px solid var(--jb-border)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--jb-hover-overlay)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--jb-toolbar)",
        border: "none",
        color: "var(--jb-text-dim)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--jb-popup)",
        border: "1px solid var(--jb-border)",
        color: "var(--jb-text)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--jb-selection)",
        color: "var(--jb-text-strong)",
      },
      ".cm-matchingBracket": {
        outline: "1px solid var(--jb-accent)",
        backgroundColor: "var(--jb-accent-subtle)",
      },
    },
    { dark },
  );
}

const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#7a8494", fontStyle: "italic" },
  { tag: t.lineComment, color: "#7a8494", fontStyle: "italic" },
  { tag: t.blockComment, color: "#7a8494", fontStyle: "italic" },
  { tag: t.keyword, color: "#61afef" },
  { tag: t.controlKeyword, color: "#61afef" },
  { tag: t.operatorKeyword, color: "#56b6c2" },
  { tag: t.moduleKeyword, color: "#61afef" },
  { tag: t.definitionKeyword, color: "#61afef" },
  { tag: t.string, color: "#98c379" },
  { tag: t.character, color: "#98c379" },
  { tag: t.number, color: "#d19a66" },
  { tag: t.bool, color: "#d19a66" },
  { tag: t.null, color: "#d19a66" },
  { tag: t.operator, color: "#56b6c2" },
  { tag: t.punctuation, color: "#c4c8d0" },
  { tag: t.meta, color: "#8b929e" },
  { tag: t.tagName, color: "#e06c75" },
  { tag: t.attributeName, color: "#d19a66" },
  { tag: t.propertyName, color: "#e06c75" },
  { tag: t.variableName, color: "#eef0f4" },
  { tag: t.definition(t.variableName), color: "#eef0f4" },
  { tag: t.function(t.variableName), color: "#e5c07b" },
  { tag: t.className, color: "#e5c07b" },
  { tag: t.typeName, color: "#56b6c2" },
  { tag: t.namespace, color: "#56b6c2" },
  { tag: t.heading, color: "#3d7eff", fontWeight: "bold" },
  { tag: t.link, color: "#3d7eff" },
  { tag: t.url, color: "#61afef" },
  { tag: t.invalid, color: "#cf5656" },
]);

const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#6b7380", fontStyle: "italic" },
  { tag: t.lineComment, color: "#6b7380", fontStyle: "italic" },
  { tag: t.blockComment, color: "#6b7380", fontStyle: "italic" },
  { tag: t.keyword, color: "#1f5fd6" },
  { tag: t.controlKeyword, color: "#1f5fd6" },
  { tag: t.operatorKeyword, color: "#0e8a8a" },
  { tag: t.moduleKeyword, color: "#1f5fd6" },
  { tag: t.definitionKeyword, color: "#1f5fd6" },
  { tag: t.string, color: "#2d8a3e" },
  { tag: t.character, color: "#2d8a3e" },
  { tag: t.number, color: "#b35c00" },
  { tag: t.bool, color: "#b35c00" },
  { tag: t.null, color: "#b35c00" },
  { tag: t.operator, color: "#0e8a8a" },
  { tag: t.punctuation, color: "#1c2330" },
  { tag: t.meta, color: "#5c677a" },
  { tag: t.tagName, color: "#c0392b" },
  { tag: t.attributeName, color: "#b35c00" },
  { tag: t.propertyName, color: "#c0392b" },
  { tag: t.variableName, color: "#0b1220" },
  { tag: t.definition(t.variableName), color: "#0b1220" },
  { tag: t.function(t.variableName), color: "#9a7d00" },
  { tag: t.className, color: "#9a7d00" },
  { tag: t.typeName, color: "#0e8a8a" },
  { tag: t.namespace, color: "#0e8a8a" },
  { tag: t.heading, color: "#1f5fd6", fontWeight: "bold" },
  { tag: t.link, color: "#1f5fd6" },
  { tag: t.url, color: "#1f5fd6" },
  { tag: t.invalid, color: "#c0392b" },
]);

export const gitnestDark: Extension = [
  chromeTheme(true),
  syntaxHighlighting(darkHighlight),
];

export const gitnestLight: Extension = [
  chromeTheme(false),
  syntaxHighlighting(lightHighlight),
];

export function gitnestEditorTheme(theme: "dark" | "light"): Extension {
  return theme === "dark" ? gitnestDark : gitnestLight;
}
