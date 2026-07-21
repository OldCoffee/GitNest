import { useQueryClient } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { documentStore, useDocument } from "../editor/documentStore";
import { gitnestEditorTheme } from "../editor/gitnestTheme";
import { languageExtension } from "../editor/languages";
import {
  javaLspExtensions,
  jdtDisplayName,
  navigateJavaSymbol,
  type JavaLspOptions,
} from "../editor/javaLspExtension";
import { isJdtUri } from "../editor/lspClient";
import { scheduleGotoLocation } from "../editor/navigationHistory";
import { formatFileSize, isImagePath } from "../lib/fileType";
import { langFromPath } from "../lib/highlight";
import { isMarkdownPath } from "../lib/markdownPreview";
import { endMeasure, startMeasure } from "../lib/performance";
import { useAppStore } from "../store/appStore";
import { usePreferences } from "../context/PreferencesContext";
import { Button, InlineAlert, Loading, Tabs } from "./ui";
import { EditorContextMenu } from "./EditorContextMenu";
import { ImageFileView } from "./ImageFileView";
import { MarkdownPreview } from "./MarkdownPreview";

type MdViewMode = "edit" | "preview";

export function FileEditor({ path, active = true }: { path: string; active?: boolean }) {
  const { t, theme } = usePreferences();
  const repo = useAppStore((s) => s.repo);
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const pushIdeNotification = useAppStore((s) => s.pushIdeNotification);
  const setIdeNotificationsOpen = useAppStore((s) => s.setIdeNotificationsOpen);
  const setJavaLspStatus = useAppStore((s) => s.setJavaLspStatus);
  const javaLspStatus = useAppStore((s) => s.javaLspStatus);
  const javaLspDetail = useAppStore((s) => s.javaLspDetail);
  const queryClient = useQueryClient();
  const document = useDocument(path);
  const [compareExternal, setCompareExternal] = useState(false);
  const [lspError, setLspError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; offset: number } | null>(null);
  const [mdView, setMdView] = useState<MdViewMode>("edit");
  const viewRef = useRef<EditorView | null>(null);
  const lspOptionsRef = useRef<JavaLspOptions | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const virtual = isJdtUri(path) || document.virtual;
  const readOnly = document.readOnly || virtual;
  const isClassFile = path.toLowerCase().endsWith(".class");
  const isJava =
    path.toLowerCase().endsWith(".java") || isJdtUri(path) || isClassFile;
  // Local .class tabs are CFR decompiled views; keep LSP for sources + jdt:// only.
  const enableLsp = !!repo && (path.toLowerCase().endsWith(".java") || isJdtUri(path));
  const isImage = isImagePath(path);
  const showMarkdownPreview =
    !isImage && isMarkdownPath(path) && !document.isBinary && !document.tooLarge;

  useEffect(() => {
    setMdView("edit");
  }, [path]);

  useEffect(() => {
    if (!active) return;
    const view = viewRef.current;
    if (!view) return;
    // Recalculate layout after becoming visible (was visibility:hidden).
    requestAnimationFrame(() => {
      view.requestMeasure();
      view.focus();
    });
  }, [active, mdView]);

  useEffect(() => {
    startMeasure("file.open");
    void documentStore.load(path).finally(() => endMeasure("file.open"));
  }, [path]);

  useEffect(() => {
    const onLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; line: number; column: number }>).detail;
      if (detail.path !== path || !viewRef.current || detail.line <= 0) return;
      const view = viewRef.current;
      const line = view.state.doc.line(Math.min(detail.line, view.state.doc.lines));
      const position = Math.min(line.to, line.from + detail.column);
      view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
      view.focus();
    };
    window.addEventListener("gitnest:goto-location", onLocation);
    return () => window.removeEventListener("gitnest:goto-location", onLocation);
  }, [path]);

  const editable = !isImage && !document.loading && !document.isBinary && !document.tooLarge;

  const save = useCallback(async (force = false) => {
    if (!editable || document.saving || readOnly) return;
    try {
      await documentStore.save(path, force);
      await queryClient.invalidateQueries({ queryKey: ["status"] });
      await queryClient.invalidateQueries({ queryKey: ["preview"] });
    } catch {
      // The document store exposes the save error in the editor header.
    }
  }, [editable, document.saving, path, queryClient, readOnly]);

  const reportLspError = useCallback(
    (message: string) => {
      pushIdeNotification({
        level: "error",
        source: "Java LSP",
        title: t("fileEditor.lspUnavailable"),
        message,
      });
      setIdeNotificationsOpen(true);
    },
    [pushIdeNotification, setIdeNotificationsOpen, t],
  );

  const openLocation = useCallback(
    (targetPath: string, line: number, column: number) => {
      openFileEditor(targetPath);
      scheduleGotoLocation(targetPath, line, column);
    },
    [openFileEditor],
  );

  const editorExtensions = useMemo(() => {
    const extensions = [
      languageExtension(path.endsWith(".class") || isJdtUri(path) ? `${path}.java` : path),
      keymap.of([
        indentWithTab,
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            void save();
            return true;
          },
        },
      ]),
      EditorView.domEventHandlers({
        contextmenu(event) {
          // Always suppress browser menu in the editor shell; Java menus come from LSP extension.
          if (!isJava) {
            event.preventDefault();
            setMenu({
              x: event.clientX,
              y: event.clientY,
              offset: viewRef.current?.state.selection.main.head ?? 0,
            });
            return true;
          }
          return false;
        },
      }),
    ];
    if (enableLsp && repo) {
      const options: JavaLspOptions = {
        path,
        rootPath: repo.path,
        isActive: () => activeRef.current,
        onOpenLocation: openLocation,
        onError: reportLspError,
        onContextMenu: (info) => setMenu(info),
        onStatus: (status, detail) => {
          // Only the visible editor drives global LSP status chrome.
          if (!activeRef.current) {
            if (status === "error") {
              setLspError(detail ?? t("fileEditor.lspUnavailable"));
            }
            return;
          }
          if (status === "error") {
            setJavaLspStatus("error", detail ?? t("fileEditor.lspUnavailable"), null);
          } else if (status === "installing" || status === "starting") {
            setJavaLspStatus(status, detail ?? null);
          }
          setLspError(status === "error" ? detail ?? t("fileEditor.lspUnavailable") : null);
        },
      };
      lspOptionsRef.current = options;
      extensions.push(...javaLspExtensions(options));
    } else {
      lspOptionsRef.current = null;
    }
    return extensions;
  }, [enableLsp, isJava, openLocation, path, repo, reportLspError, save, setJavaLspStatus, t]);

  useEffect(() => {
    if (!enableLsp) {
      setLspError(null);
      return;
    }
    // Keep the editor banner in sync with global LSP chrome (including clear after settings retry).
    if (javaLspStatus === "error") {
      setLspError(javaLspDetail ?? t("fileEditor.lspUnavailable"));
    } else if (
      javaLspStatus === "ready" ||
      javaLspStatus === "indexing" ||
      javaLspStatus === "starting" ||
      javaLspStatus === "installing" ||
      javaLspStatus === "idle"
    ) {
      setLspError(null);
    }
  }, [enableLsp, path, javaLspStatus, javaLspDetail, t]);

  async function openInSystem() {
    if (virtual || isJdtUri(path)) return;
    const abs = path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)
      ? path
      : repo
        ? `${repo.path.replace(/[/\\]+$/, "")}/${path}`
        : path;
    try {
      await openPath(abs);
    } catch {
      // ignore
    }
  }

  function runNavigation(method: "textDocument/definition" | "textDocument/references") {
    const view = viewRef.current;
    const options = lspOptionsRef.current;
    if (!view || !options) {
      reportLspError(t("fileEditor.lspUnavailable"));
      return;
    }
    void navigateJavaSymbol(view, options, method, menu?.offset);
  }

  if (document.loading) {
    return <Loading className="p-4">{t("common.loading")}</Loading>;
  }
  if (document.error && document.version === 0) {
    return (
      <InlineAlert level="error" className="m-4">
        {document.error}
      </InlineAlert>
    );
  }

  const language =
    langFromPath(path) ??
    (isJdtUri(path) ? "java" : null) ??
    (isImage ? "image" : null);
  const title = isJdtUri(path) ? jdtDisplayName(path) : path;
  const absoluteFilePath = (() => {
    if (isJdtUri(path) || virtual) return null;
    if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) return path;
    if (!repo) return null;
    return `${repo.path.replace(/[\\/]+$/, "")}/${path.replace(/^[\\/]+/, "")}`;
  })();
  const showPreviewPane = showMarkdownPreview && mdView === "preview";

  return (
    <div className="flex h-full flex-col">
      <div className="jb-preview-header flex items-center gap-2">
        <span className="min-w-0 truncate" title={path}>
          {title}
        </span>
        {virtual && <span className="jb-text-dim">{t("fileEditor.decompiled")}</span>}
        {language && <span className="jb-text-accent">{language}</span>}
        {document.sizeBytes > 0 && <span>{formatFileSize(document.sizeBytes)}</span>}
        {document.dirty && <span className="jb-file-editor-dirty">●</span>}
        <span className="flex-1" />
        {showMarkdownPreview && (
          <Tabs
            variant="segmented"
            aria-label={t("fileEditor.mdView")}
            value={mdView}
            onChange={setMdView}
            tabs={[
              { id: "edit", label: t("fileEditor.mdEdit") },
              { id: "preview", label: t("fileEditor.mdPreview") },
            ]}
          />
        )}
        {isImage && !virtual && (
          <Button className="py-0.5" onClick={() => void openInSystem()}>
            {t("fileEditor.openInSystem")}
          </Button>
        )}
        {editable && !readOnly && (
          <Button
            className="py-0.5"
            disabled={
              !document.dirty ||
              document.saving ||
              document.externalText != null
            }
            onClick={() => void save()}
          >
            {document.saving
              ? t("fileEditor.saving")
              : document.dirty
                ? t("fileEditor.save")
                : t("fileEditor.saved")}
          </Button>
        )}
      </div>

      {lspError && (
        <div className="jb-file-conflict-bar">
          <span>{t("fileEditor.lspUnavailable")}: {lspError}</span>
          <Button onClick={() => openSettingsEditor()}>
            {t("fileEditor.openJavaSettings")}
          </Button>
        </div>
      )}

      {document.error && !document.externalText && (
        <InlineAlert level="error" className="mx-2 my-1">{document.error}</InlineAlert>
      )}
      {document.externalText != null && (
        <div className="jb-file-conflict-bar">
          <span>{t("fileEditor.externalChanged")}</span>
          <Button onClick={() => setCompareExternal((value) => !value)}>
            {t("fileEditor.compare")}
          </Button>
          <Button
            onClick={() => {
              documentStore.acceptExternal(path);
              setCompareExternal(false);
            }}
          >
            {t("fileEditor.reload")}
          </Button>
          <Button variant="primary" onClick={() => void save(true)}>
            {t("fileEditor.overwrite")}
          </Button>
        </div>
      )}

      {isImage ? (
        <ImageFileView
          absolutePath={absoluteFilePath}
          alt={title}
          onOpenInSystem={virtual ? undefined : () => void openInSystem()}
        />
      ) : editable ? (
        showPreviewPane ? (
          <MarkdownPreview source={document.text} absoluteFilePath={absoluteFilePath} />
        ) : (
          <div className={compareExternal ? "jb-file-compare-grid" : "min-h-0 flex-1"}>
            <CodeMirror
              className="jb-code-editor min-h-0 flex-1"
              value={document.text}
              height="100%"
              theme={gitnestEditorTheme(theme === "dark" ? "dark" : "light")}
              readOnly={readOnly}
              editable={!readOnly}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                bracketMatching: true,
                autocompletion: !readOnly,
                rectangularSelection: true,
                crosshairCursor: true,
              }}
              extensions={editorExtensions}
              onCreateEditor={(view) => {
                viewRef.current = view;
              }}
              onChange={(value, update) => {
                if (readOnly) return;
                const selection = update.state.selection.main;
                documentStore.update(path, value, {
                  anchor: selection.anchor,
                  head: selection.head,
                });
              }}
            />
            {compareExternal && document.externalText != null && (
              <CodeMirror
                className="jb-code-editor jb-code-editor-external min-h-0"
                value={document.externalText}
                height="100%"
                theme={gitnestEditorTheme(theme === "dark" ? "dark" : "light")}
                readOnly
                editable={false}
                basicSetup={{ lineNumbers: true, foldGutter: true }}
                extensions={[languageExtension(path)]}
              />
            )}
          </div>
        )
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
          <p className="text-xs jb-text-dim">
            {document.tooLarge ? t("fileEditor.tooLarge") : t("fileEditor.binaryNotEditable")}
          </p>
          {document.sizeBytes > 0 && (
            <p className="text-xs jb-text-dim">{formatFileSize(document.sizeBytes)}</p>
          )}
          {!virtual && (
            <Button onClick={() => void openInSystem()}>{t("fileEditor.openInSystem")}</Button>
          )}
        </div>
      )}

      {menu && (
        <EditorContextMenu
          x={menu.x}
          y={menu.y}
          javaEnabled={enableLsp && !lspError}
          onGoToDefinition={() => runNavigation("textDocument/definition")}
          onFindUsages={() => runNavigation("textDocument/references")}
          onCopy={() => {
            const view = viewRef.current;
            if (!view) return;
            const { from, to } = view.state.selection.main;
            let text = "";
            if (from === to) {
              const word = view.state.wordAt(from);
              if (word) text = view.state.sliceDoc(word.from, word.to);
            } else {
              text = view.state.sliceDoc(from, to);
            }
            if (text) void navigator.clipboard.writeText(text);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
