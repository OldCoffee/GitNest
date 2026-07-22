import { useRef } from "react";
import { useAppStore } from "../store/appStore";
import type { BottomToolWindow as BottomToolWindowId } from "../lib/types";
import { TerminalPanel, type TerminalPanelHandle } from "./TerminalPanel";
import { CloseIcon, ConsoleIcon, IconButton, Tabs, TerminalIcon, TrashIcon, type TabItem } from "./ui";
import { useT } from "../context/PreferencesContext";

type BottomTab = Exclude<BottomToolWindowId, null>;

export function BottomToolWindow() {
  const t = useT();
  const bottomToolWindow = useAppStore((s) => s.bottomToolWindow);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const toggleBottomToolWindow = useAppStore((s) => s.toggleBottomToolWindow);
  const vcsConsoleOutput = useAppStore((s) => s.vcsConsoleOutput);
  const clearVcsOutput = useAppStore((s) => s.clearVcsOutput);
  const repoPath = useAppStore((s) => s.repo?.path ?? null);
  const terminalRef = useRef<TerminalPanelHandle>(null);

  const activeTab: BottomTab = bottomToolWindow ?? "vcsConsole";

  const tabs: ReadonlyArray<TabItem<BottomTab>> = [
    {
      id: "terminal",
      label: (
        <span className="jb-bottom-tab-label">
          <TerminalIcon className="jb-bottom-tab-icon" />
          {t("bottom.terminalTab")}
        </span>
      ),
    },
    {
      id: "vcsConsole",
      label: (
        <span className="jb-bottom-tab-label">
          <ConsoleIcon className="jb-bottom-tab-icon" />
          {t("bottom.vcsConsole")}
        </span>
      ),
    },
  ];

  return (
    <div className="jb-bottom-window flex h-full flex-col">
      <div className="jb-bottom-tab-bar flex shrink-0 items-center">
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={setBottomToolWindow}
          variant="terminal"
          className="min-w-0 flex-1 border-b-0"
        />
        <div className="jb-bottom-tab-actions flex shrink-0 items-center gap-1 pr-2">
          {activeTab === "vcsConsole" && (
            <IconButton size="sm" label={t("bottom.clear")} onClick={clearVcsOutput}>
              <TrashIcon size="sm" />
            </IconButton>
          )}
          {activeTab === "terminal" && (
            <IconButton
              size="sm"
              label={t("bottom.clear")}
              onClick={() => terminalRef.current?.clearActive()}
            >
              <TrashIcon size="sm" />
            </IconButton>
          )}
          <IconButton
            size="sm"
            label={t("common.close")}
            onClick={() => toggleBottomToolWindow(activeTab)}
          >
            <CloseIcon size="sm" />
          </IconButton>
        </div>
      </div>
      <div className="jb-bottom-content relative min-h-0 flex-1 overflow-hidden">
        {/* Keep TerminalPanel mounted so PTY sessions survive VCS Console switches.
            Remount when the open repository changes so tabs cannot outlive close_all. */}
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "terminal" ? "block" : "none" }}
          aria-hidden={activeTab !== "terminal"}
        >
          <TerminalPanel
            key={repoPath ?? "none"}
            ref={terminalRef}
            className="h-full"
          />
        </div>
        <pre
          className="jb-vcs-console h-full overflow-auto p-3 font-mono text-xs whitespace-pre-wrap"
          style={{ display: activeTab === "vcsConsole" ? "block" : "none" }}
          aria-hidden={activeTab !== "vcsConsole"}
        >
          {vcsConsoleOutput || (
            <span className="jb-text-dim">{t("bottom.vcsPlaceholder")}</span>
          )}
        </pre>
      </div>
    </div>
  );
}
