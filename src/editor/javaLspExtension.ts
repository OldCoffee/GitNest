import type { Completion, CompletionContext } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { Extension, Text } from "@codemirror/state";
import { EditorView, ViewPlugin, hoverTooltip, keymap } from "@codemirror/view";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { api } from "../lib/api";
import {
  fileUri,
  formatLspError,
  isClasspathNavigationUri,
  isJdtUri,
  javaLspClient,
  jdtDisplayName,
  uriToPath,
} from "./lspClient";
import { documentStore } from "./documentStore";
import { navigationHistory } from "./navigationHistory";
import { uiPrompt } from "../lib/uiPrompt";

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface LspTextEdit {
  range: LspRange;
  newText: string;
}

interface LspLocation {
  uri?: string;
  targetUri?: string;
  range?: LspRange;
  targetRange?: LspRange;
  targetSelectionRange?: LspRange;
}

interface JavaLspOptions {
  path: string;
  rootPath: string;
  /** When false, skip diagnostics updates (keep-alive hidden tabs). */
  isActive?: () => boolean;
  onOpenLocation: (path: string, line: number, column: number) => void;
  onError: (message: string) => void;
  onContextMenu?: (info: { x: number; y: number; offset: number }) => void;
  onStatus?: (
    status: "starting" | "installing" | "indexing" | "ready" | "error",
    detail?: string,
  ) => void;
}

export type { JavaLspOptions };

function position(doc: Text, value: LspPosition): number {
  const line = doc.line(Math.min(value.line + 1, doc.lines));
  return Math.min(line.to, line.from + value.character);
}

function lspPosition(view: EditorView, offset: number): LspPosition {
  const line = view.state.doc.lineAt(offset);
  return { line: line.number - 1, character: offset - line.from };
}

function applyEdits(view: EditorView, edits: LspTextEdit[]) {
  const changes = edits
    .map((edit) => ({
      from: position(view.state.doc, edit.range.start),
      to: position(view.state.doc, edit.range.end),
      insert: edit.newText,
    }))
    .sort((left, right) => right.from - left.from);
  if (changes.length) view.dispatch({ changes });
}

function documentUri(options: JavaLspOptions): string {
  return fileUri(options.rootPath, options.path);
}

function completionSource(options: JavaLspOptions) {
  return async (context: CompletionContext) => {
    try {
      if (!context.view) return null;
      const result = (await javaLspClient.request("textDocument/completion", {
        textDocument: { uri: documentUri(options) },
        position: lspPosition(context.view, context.pos),
        context: { triggerKind: context.explicit ? 1 : 2 },
      })) as { items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
      const items = Array.isArray(result) ? result : result?.items ?? [];
      const completions: Completion[] = items.map((item) => ({
        label: String(item.label ?? ""),
        detail: item.detail ? String(item.detail) : undefined,
        type: completionKind(Number(item.kind ?? 0)),
        apply: String(item.insertText ?? item.label ?? ""),
      }));
      return { from: context.matchBefore(/[\w$]*/)?.from ?? context.pos, options: completions };
    } catch {
      return null;
    }
  };
}

function completionKind(kind: number): string {
  if ([2, 3, 4, 5, 6].includes(kind)) return "function";
  if ([7, 8, 9, 10].includes(kind)) return "class";
  if ([14, 15, 21].includes(kind)) return "keyword";
  return "variable";
}

function markdownText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(markdownText).join("\n");
  if (value && typeof value === "object" && "value" in value) {
    return String((value as { value: unknown }).value);
  }
  return "";
}

function normalizeLocations(result: unknown): LspLocation[] {
  if (!result) return [];
  const list = Array.isArray(result) ? result : [result];
  return (list as LspLocation[]).filter(
    (loc) => !!(loc && (loc.uri || loc.targetUri)),
  );
}

function wordAt(view: EditorView, offset: number): string {
  const line = view.state.doc.lineAt(offset);
  const text = line.text;
  let start = offset - line.from;
  let end = start;
  while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1]!)) start -= 1;
  while (end < text.length && /[A-Za-z0-9_$]/.test(text[end]!)) end += 1;
  return text.slice(start, end);
}

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function javaLspExtensions(options: JavaLspOptions): Extension[] {
  const uri = documentUri(options);
  let version = 1;
  let changeTimer: ReturnType<typeof setTimeout> | null = null;

  const lifecycle = ViewPlugin.define((view) => {
    let unsubscribe = () => {};
    let closed = false;
    let diagnosticsTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingDiagnostics: Diagnostic[] | null = null;
    // Always paint the editor first — cold JDK probe + JVM spawn must not race the first frame.
    const attachDelay =
      javaLspClient.isReady() ? 0 : javaLspClient.isStarting() ? 250 : 450;
    const startTimer = window.setTimeout(() => {
      void (async () => {
        try {
          if (javaLspClient.isReady()) {
            options.onStatus?.("ready");
          } else if (javaLspClient.isStarting()) {
            options.onStatus?.("indexing");
          } else {
            options.onStatus?.("starting");
          }
          await javaLspClient.ensureStarted(options.rootPath);
          if (closed) return;
          unsubscribe = javaLspClient.subscribe("textDocument/publishDiagnostics", (value) => {
            if (options.isActive && !options.isActive()) return;
            const params = value as {
              uri: string;
              diagnostics: Array<{
                range: LspRange;
                severity?: number;
                message: string;
                source?: string;
              }>;
            };
            if (params.uri !== uri) return;
            pendingDiagnostics = params.diagnostics.map((diagnostic) => ({
              from: position(view.state.doc, diagnostic.range.start),
              to: position(view.state.doc, diagnostic.range.end),
              severity:
                diagnostic.severity === 1
                  ? "error"
                  : diagnostic.severity === 2
                    ? "warning"
                    : "info",
              message: diagnostic.message,
              source: diagnostic.source,
            }));
            // JDT can flood diagnostics during import — coalesce onto one frame.
            if (diagnosticsTimer != null) return;
            diagnosticsTimer = setTimeout(() => {
              diagnosticsTimer = null;
              if (closed || !pendingDiagnostics) return;
              const next = pendingDiagnostics;
              pendingDiagnostics = null;
              view.dispatch(setDiagnostics(view.state, next));
            }, 120);
          });
          await javaLspClient.notify("textDocument/didOpen", {
            textDocument: {
              uri,
              languageId: "java",
              version,
              text: view.state.doc.toString(),
            },
          });
          if (!closed) options.onStatus?.("ready");
        } catch (error) {
          if (closed) return;
          const message = formatLspError(error);
          options.onStatus?.("error", message);
          options.onError(message);
        }
      })();
    }, attachDelay);

    return {
      update(update) {
        if (!update.docChanged) return;
        if (changeTimer) clearTimeout(changeTimer);
        changeTimer = setTimeout(() => {
          version += 1;
          void javaLspClient.notify("textDocument/didChange", {
            textDocument: { uri, version },
            contentChanges: [{ text: update.state.doc.toString() }],
          });
        }, 180);
      },
      destroy() {
        closed = true;
        window.clearTimeout(startTimer);
        if (changeTimer) clearTimeout(changeTimer);
        if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
        unsubscribe();
        void javaLspClient.notify("textDocument/didClose", {
          textDocument: { uri },
        });
      },
    };
  });

  const hover = hoverTooltip(async (view, offset) => {
    try {
      const result = (await javaLspClient.request("textDocument/hover", {
        textDocument: { uri },
        position: lspPosition(view, offset),
      })) as { contents?: unknown } | null;
      const text = markdownText(result?.contents);
      if (!text) return null;
      return {
        pos: offset,
        create() {
          const dom = document.createElement("div");
          dom.className = "jb-lsp-hover";
          dom.textContent = text;
          return { dom };
        },
      };
    } catch {
      return null;
    }
  });

  const clickNav = EditorView.domEventHandlers({
    click(event, view) {
      if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      event.preventDefault();
      view.dispatch({ selection: { anchor: pos } });
      void goToLocation(view, options, uri, "textDocument/definition", {}, pos);
      return true;
    },
    contextmenu(event, view) {
      event.preventDefault();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos != null) {
        view.dispatch({ selection: { anchor: pos } });
      }
      options.onContextMenu?.({
        x: event.clientX,
        y: event.clientY,
        offset: pos ?? view.state.selection.main.head,
      });
      return true;
    },
  });

  const modCursor = EditorView.theme({
    "&.cm-editor.cm-mod-nav .cm-content": {
      cursor: "pointer",
    },
  });

  const modNavClass = ViewPlugin.fromClass(
    class {
      constructor(private readonly view: EditorView) {
        this.onKey = this.onKey.bind(this);
        window.addEventListener("keydown", this.onKey);
        window.addEventListener("keyup", this.onKey);
        window.addEventListener("blur", this.onKey);
      }
      onKey(event?: Event) {
        const pressed =
          event instanceof KeyboardEvent
            ? event.metaKey || event.ctrlKey
            : false;
        this.view.dom.classList.toggle("cm-mod-nav", pressed);
      }
      destroy() {
        window.removeEventListener("keydown", this.onKey);
        window.removeEventListener("keyup", this.onKey);
        window.removeEventListener("blur", this.onKey);
        this.view.dom.classList.remove("cm-mod-nav");
      }
    },
  );

  const commands = keymap.of([
    {
      key: "Mod-Alt-ArrowLeft",
      preventDefault: true,
      run: () => {
        window.dispatchEvent(new CustomEvent("gitnest:navigate-back"));
        return true;
      },
    },
    {
      key: "Mod-Alt-ArrowRight",
      preventDefault: true,
      run: () => {
        window.dispatchEvent(new CustomEvent("gitnest:navigate-forward"));
        return true;
      },
    },
    {
      key: "F12",
      run: (view) => {
        void goToLocation(view, options, uri, "textDocument/definition");
        return true;
      },
    },
    {
      key: "Mod-b",
      run: (view) => {
        void goToLocation(view, options, uri, "textDocument/definition");
        return true;
      },
    },
    {
      key: "Shift-F12",
      run: (view) => {
        void goToLocation(view, options, uri, "textDocument/references", {
          context: { includeDeclaration: false },
        });
        return true;
      },
    },
    {
      key: "Shift-F6",
      run: (view) => {
        void uiPrompt({ message: "Rename symbol" }).then((newName) => {
          if (!newName) return;
          void javaLspClient
            .request("textDocument/rename", {
              textDocument: { uri },
              position: lspPosition(view, view.state.selection.main.head),
              newName,
            })
            .then((result) => {
              const changes = (result as { changes?: Record<string, LspTextEdit[]> } | null)?.changes;
              if (changes?.[uri]) applyEdits(view, changes[uri]);
            })
            .catch((error) => options.onError(formatLspError(error)));
        });
        return true;
      },
    },
    {
      key: "Alt-Shift-f",
      run: (view) => {
        void javaLspClient
          .request("textDocument/formatting", {
            textDocument: { uri },
            options: { tabSize: 4, insertSpaces: true },
          })
          .then((result) => applyEdits(view, (result as LspTextEdit[] | null) ?? []))
          .catch((error) => options.onError(formatLspError(error)));
        return true;
      },
    },
    {
      key: "Alt-Enter",
      run: (view) => {
        const head = lspPosition(view, view.state.selection.main.head);
        void javaLspClient.request("textDocument/codeAction", {
          textDocument: { uri },
          range: { start: head, end: head },
          context: { diagnostics: [] },
        });
        return true;
      },
    },
  ]);

  return [
    lifecycle,
    hover,
    clickNav,
    modCursor,
    modNavClass,
    autocompletion({ override: [completionSource(options)] }),
    commands,
  ];
}

export async function navigateJavaSymbol(
  view: EditorView,
  options: JavaLspOptions,
  method: "textDocument/definition" | "textDocument/references" = "textDocument/definition",
  offset?: number,
) {
  await goToLocation(
    view,
    options,
    documentUri(options),
    method,
    method === "textDocument/references"
      ? { context: { includeDeclaration: false } }
      : {},
    offset,
  );
}

async function goToLocation(
  view: EditorView,
  options: JavaLspOptions,
  uri: string,
  method: "textDocument/definition" | "textDocument/references" | "textDocument/typeDefinition",
  extra: Record<string, unknown> = {},
  offset?: number,
) {
  try {
    await javaLspClient.ensureStarted(options.rootPath);
    const pos = offset ?? view.state.selection.main.head;
    let locations: LspLocation[] = [];
    let lastError: string | null = null;

    const attempts = javaLspClient.isProjectReady() ? 3 : 8;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        let result = await javaLspClient.request(method, {
          textDocument: { uri },
          position: lspPosition(view, pos),
          ...extra,
        });
        locations = normalizeLocations(result);
        if (locations.length === 0 && method === "textDocument/definition") {
          result = await javaLspClient.request("textDocument/typeDefinition", {
            textDocument: { uri },
            position: lspPosition(view, pos),
          });
          locations = normalizeLocations(result);
        }
        if (locations.length > 0) break;
      } catch (error) {
        lastError = formatLspError(error);
      }
      // Classpath may still be importing for multi-module Maven projects.
      await sleep(500 * (attempt + 1));
    }

    if (locations.length === 0 && method === "textDocument/definition") {
      const symbol = wordAt(view, pos);
      if (symbol.length >= 2) {
        try {
          const symbols = (await javaLspClient.request("workspace/symbol", {
            query: symbol,
          })) as Array<{
            name?: string;
            location?: LspLocation | { uri?: string; range?: LspRange };
          }> | null;
          const matches = (symbols ?? []).filter(
            (item) =>
              item.name === symbol ||
              item.name?.endsWith(`.${symbol}`) ||
              item.name?.endsWith(symbol),
          );
          for (const item of matches) {
            const loc = item.location;
            if (!loc) continue;
            const targetUri = "uri" in loc ? loc.uri : undefined;
            if (!targetUri) continue;
            locations = [
              {
                uri: targetUri,
                range:
                  "range" in loc && loc.range
                    ? loc.range
                    : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              },
            ];
            break;
          }
        } catch (error) {
          lastError = formatLspError(error);
        }
      }
    }

    const location = locations[0];
    if (!location) {
      if (!javaLspClient.isProjectReady()) {
        options.onError(
          "Maven/Gradle 项目仍在索引中，请等待状态变为 Java LSP 后再试跳转。",
        );
      } else if (lastError) {
        options.onError(lastError);
      } else {
        options.onError("No definition found");
      }
      return;
    }
    const targetUri = location.uri ?? location.targetUri;
    const range =
      location.targetSelectionRange ??
      location.targetRange ??
      location.range ?? {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      };
    if (!targetUri) {
      options.onError(lastError ?? "No definition found");
      return;
    }

    const fromLine = view.state.doc.lineAt(pos);
    const from = {
      path: options.path,
      line: fromLine.number,
      column: Math.max(0, pos - fromLine.from),
    };
    const openTarget = (targetPath: string, line: number, column: number) => {
      navigationHistory.recordJump(from, { path: targetPath, line, column });
      options.onOpenLocation(targetPath, line, column);
    };

    // JDK / Maven dependency types → decompiled virtual buffer (not a real FS path).
    if (isJdtUri(targetUri) || isClasspathNavigationUri(targetUri)) {
      try {
        const text = await javaLspClient.classFileContents(targetUri);
        const virtualKey = isJdtUri(targetUri) ? targetUri : `jdt://contents/${jdtDisplayName(targetUri)}?${encodeURIComponent(targetUri)}`;
        documentStore.openVirtual(virtualKey, text, { readOnly: true });
        openTarget(virtualKey, range.start.line + 1, range.start.character);
        return;
      } catch (error) {
        if (isJdtUri(targetUri)) {
          options.onError(formatLspError(error));
          return;
        }
        // Fall through and try as a normal file URI.
      }
    }

    const targetPath = uriToPath(targetUri, options.rootPath);
    if (!targetPath) {
      options.onError("No definition found");
      return;
    }

    // Absolute .class outside the workspace — decompile instead of raw read.
    if (
      (targetPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(targetPath)) &&
      targetPath.toLowerCase().endsWith(".class")
    ) {
      try {
        const data = await api.decompileClassFile(targetPath);
        const virtualKey = `jdt://contents/${jdtDisplayName(targetPath)}`;
        documentStore.openVirtual(virtualKey, data.content, { readOnly: true });
        openTarget(virtualKey, range.start.line + 1, range.start.character);
        return;
      } catch (error) {
        options.onError(formatLspError(error));
        return;
      }
    }

    openTarget(targetPath, range.start.line + 1, range.start.character);
  } catch (error) {
    options.onError(formatLspError(error));
  }
}

export { jdtDisplayName };
