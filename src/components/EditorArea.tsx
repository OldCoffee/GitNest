import { useAppStore } from "../store/appStore";
import { DiffViewer } from "./DiffViewer";
import { FileEditor } from "./FileEditor";
import { LogEditor } from "./LogEditor";
import { SettingsPage } from "../pages/SettingsPage";
import { BranchesPage } from "../pages/BranchesPage";
import { EditorTabContextMenu } from "./EditorTabContextMenu";
import { TabBar } from "./ui";
import { cn } from "../lib/utils";
import { isEditorTabClosable } from "../lib/editorTabPaths";
import { useEffect, useState } from "react";
import type { EditorTab } from "../lib/types";
import { useT } from "../context/PreferencesContext";

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

export function EditorArea() {
  const t = useT();
  const editorTabs = useAppStore((s) => s.editorTabs);
  const activeEditorTabId = useAppStore((s) => s.activeEditorTabId);
  const setActiveEditorTab = useAppStore((s) => s.setActiveEditorTab);
  const closeEditorTab = useAppStore((s) => s.closeEditorTab);
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const active =
    editorTabs.find((t) => t.id === activeEditorTabId) ??
    editorTabs[editorTabs.length - 1];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "w") return;
      if (!active || !isEditorTabClosable(active)) return;
      e.preventDefault();
      closeEditorTab(active.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, closeEditorTab]);

  const contextTab = contextMenu
    ? editorTabs.find((t) => t.id === contextMenu.tabId)
    : null;
  const contextTabIndex = contextTab
    ? editorTabs.findIndex((t) => t.id === contextTab.id)
    : -1;

  return (
    <div className="jb-editor-bg flex min-w-0 flex-1 flex-col">
      {editorTabs.length > 0 && (
        <TabBar>
          {editorTabs.map((tab) => (
            <div
              key={tab.id}
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
                {editorTabLabel(tab, t)}
              </button>
              {isEditorTabClosable(tab) && (
                <button
                  type="button"
                  className="jb-tab-close"
                  onClick={() => closeEditorTab(tab.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </TabBar>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!active && <WelcomePlaceholder />}
        {active?.kind === "welcome" && <WelcomePlaceholder />}
        {active?.kind === "diff" && active.diff && <DiffViewer tab={active.diff} />}
        {active?.kind === "file" && active.filePath && (
          <FileEditor key={active.filePath} path={active.filePath} />
        )}
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
        />
      )}
    </div>
  );
}
