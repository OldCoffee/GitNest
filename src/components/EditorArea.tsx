import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorTab } from "../lib/types";
import { useT } from "../context/PreferencesContext";
import { documentStore, useDocumentDirty } from "../editor/documentStore";
import {
  navigationHistory,
  scheduleGotoLocation,
} from "../editor/navigationHistory";
import { useAppStore } from "../store/appStore";
import { DiffViewer } from "./DiffViewer";
import { FileEditor } from "./FileEditor";
import { LogEditor } from "./LogEditor";
import { SettingsPage } from "../pages/SettingsPage";
import { BranchesPage } from "../pages/BranchesPage";
import { EditorTabContextMenu } from "./EditorTabContextMenu";
import { CloseIcon, ConfirmDialog, FileTypeIcon, IconButton, TabBar } from "./ui";
import { cn } from "../lib/utils";
import { isEditorTabClosable } from "../lib/editorTabPaths";

function WelcomePlaceholder() {
  const t = useT();
  return (
    <div className="jb-welcome-placeholder">
      <div className="jb-welcome-title">{t("welcome.title")}</div>
      <p className="text-xs">{t("editor.welcomeHint")}</p>
    </div>
  );
}

function editorTabLabel(tab: EditorTab, t: ReturnType<typeof useT>): string {
  switch (tab.kind) {
    case "welcome":
      return t("editor.welcomeTab");
    case "log":
      return t("editor.gitLog");
    case "settings":
      return t("editor.settings");
    case "branches":
      return t("editor.branches");
    default:
      return tab.title;
  }
}

function EditorTabTitle({ tab }: { tab: EditorTab }) {
  if (tab.kind !== "file" || !tab.filePath) return <>{tab.title}</>;
  return <FileEditorTabTitle path={tab.filePath} title={tab.title} />;
}

function FileEditorTabTitle({ path, title }: { path: string; title: string }) {
  const dirty = useDocumentDirty(path);
  return (
    <>
      {title}
      {dirty && <span className="jb-tab-dirty" aria-label="Modified">●</span>}
    </>
  );
}

/** Keep CodeMirror alive after first open; hide inactive tabs instead of remounting. */
function KeptAliveFileEditor({
  path,
  active,
}: {
  path: string;
  active: boolean;
}) {
  const [activated, setActivated] = useState(active);

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  if (!activated) return null;

  return (
    <div
      className={cn("jb-editor-pane", active ? "jb-editor-pane-active" : "jb-editor-pane-hidden")}
      aria-hidden={!active}
    >
      <FileEditor path={path} active={active} />
    </div>
  );
}

export function EditorArea() {
  const t = useT();
  const editorTabs = useAppStore((s) => s.editorTabs);
  const activeEditorTabId = useAppStore((s) => s.activeEditorTabId);
  const setActiveEditorTab = useAppStore((s) => s.setActiveEditorTab);
  const closeEditorTab = useAppStore((s) => s.closeEditorTab);
  const forceCloseEditorTab = useAppStore((s) => s.forceCloseEditorTab);
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const [pendingClose, setPendingClose] = useState<EditorTab | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  const active =
    editorTabs.find((t) => t.id === activeEditorTabId) ??
    editorTabs[editorTabs.length - 1];

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeTabRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [active?.id, editorTabs.length]);

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;

    const syncOverflow = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const overflow = maxScroll > 1;
      el.dataset.overflow = overflow ? "true" : "false";
      el.dataset.scrollStart = !overflow || el.scrollLeft <= 1 ? "true" : "false";
      el.dataset.scrollEnd = !overflow || el.scrollLeft >= maxScroll - 1 ? "true" : "false";
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
      syncOverflow();
    };

    syncOverflow();
    el.addEventListener("scroll", syncOverflow, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", syncOverflow);
    return () => {
      el.removeEventListener("scroll", syncOverflow);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", syncOverflow);
    };
  }, [editorTabs.length]);
  const fileTabs = editorTabs.filter(
    (tab): tab is EditorTab & { filePath: string } =>
      tab.kind === "file" && typeof tab.filePath === "string" && tab.filePath.length > 0,
  );

  const requestClose = useCallback((tab: EditorTab) => {
    if (tab.kind === "file" && tab.filePath && documentStore.isDirty(tab.filePath)) {
      setPendingClose(tab);
      return;
    }
    closeEditorTab(tab.id);
  }, [closeEditorTab]);

  const restoreLocation = useCallback(
    (path: string, line: number, column: number) => {
      navigationHistory.runSilent(() => {
        openFileEditor(path);
        scheduleGotoLocation(path, line, column);
      });
    },
    [openFileEditor],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "w") {
        if (!active || !isEditorTabClosable(active)) return;
        e.preventDefault();
        requestClose(active);
        return;
      }
      // Cmd+Option+← / → — Navigate Back / Forward (after go-to-definition).
      if (mod && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const loc =
          e.key === "ArrowLeft" ? navigationHistory.goBack() : navigationHistory.goForward();
        if (loc) restoreLocation(loc.path, loc.line, loc.column);
      }
    }
    function onNavigateBack() {
      const loc = navigationHistory.goBack();
      if (loc) restoreLocation(loc.path, loc.line, loc.column);
    }
    function onNavigateForward() {
      const loc = navigationHistory.goForward();
      if (loc) restoreLocation(loc.path, loc.line, loc.column);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("gitnest:navigate-back", onNavigateBack);
    window.addEventListener("gitnest:navigate-forward", onNavigateForward);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("gitnest:navigate-back", onNavigateBack);
      window.removeEventListener("gitnest:navigate-forward", onNavigateForward);
    };
  }, [active, requestClose, restoreLocation]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (documentStore.dirtyPaths().length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const contextTab = contextMenu
    ? editorTabs.find((t) => t.id === contextMenu.tabId)
    : null;
  const contextTabIndex = contextTab
    ? editorTabs.findIndex((t) => t.id === contextTab.id)
    : -1;

  return (
    <div className="jb-editor-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {editorTabs.length > 0 && (
        <TabBar
          variant="editor"
          className="min-w-0"
          ref={tabBarRef}
        >
          {editorTabs.map((tab) => (
            <div
              key={tab.id}
              ref={tab.id === active?.id ? activeTabRef : undefined}
              className={cn(
                "jb-tab flex items-center gap-1",
                tab.id === active?.id && "jb-tab-active",
                tab.pinned && "jb-tab-pinned",
              )}
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveEditorTab(tab.id);
                setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
            >
              <button type="button" onClick={() => setActiveEditorTab(tab.id)}>
                {tab.pinned && <span className="jb-tab-pin-dot" aria-hidden />}
                {tab.kind === "file" && tab.filePath && (
                  <FileTypeIcon path={tab.filePath} size="sm" className="jb-tab-file-icon" />
                )}
                {tab.kind === "file" ? <EditorTabTitle tab={tab} /> : editorTabLabel(tab, t)}
              </button>
              {isEditorTabClosable(tab) && (
                <IconButton
                  surface="tabClose"
                  label={t("editor.closeTab")}
                  onClick={() => requestClose(tab)}
                >
                  <CloseIcon size="xs" />
                </IconButton>
              )}
            </div>
          ))}
        </TabBar>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!active && <WelcomePlaceholder />}
        {active?.kind === "welcome" && <WelcomePlaceholder />}
        {active?.kind === "diff" && active.diff && <DiffViewer tab={active.diff} />}
        {fileTabs.map((tab) => (
          <KeptAliveFileEditor
            key={tab.id}
            path={tab.filePath}
            active={active?.id === tab.id}
          />
        ))}
        {active?.kind === "log" && <LogEditor />}
        {active?.kind === "branches" && <BranchesPage />}
        {active?.kind === "settings" && <SettingsPage />}
      </div>
      {contextMenu && contextTab && (
        <EditorTabContextMenu
          tab={contextTab}
          tabIndex={contextTabIndex}
          tabCount={editorTabs.length}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRequestClose={requestClose}
        />
      )}
      {pendingClose && (
        <ConfirmDialog
          title={t("fileEditor.unsavedTitle")}
          message={t("fileEditor.unsavedMessage", { name: pendingClose.title })}
          confirmLabel={t("fileEditor.discardAndClose")}
          danger
          onCancel={() => setPendingClose(null)}
          onConfirm={() => {
            forceCloseEditorTab(pendingClose.id);
            setPendingClose(null);
          }}
        />
      )}
    </div>
  );
}
