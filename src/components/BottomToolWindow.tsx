import { useAppStore } from "../store/appStore";
import type { BottomToolWindow as BottomToolWindowId } from "../lib/types";
import { TerminalPanel } from "./TerminalPanel";
import { Tabs, type TabItem } from "./ui";
import { useT } from "../context/PreferencesContext";

type BottomTab = Exclude<BottomToolWindowId, null>;

function TerminalIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="jb-bottom-tab-icon">
      <path
        fill="currentColor"
        d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Zm1.6 2.4 2.3 2.1-2.3 2.1-.9-1 1.2-1.1-1.2-1.1.9-1ZM8 9h3v1.2H8V9Z"
      />
    </svg>
  );
}

function ConsoleIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="jb-bottom-tab-icon">
      <path
        fill="currentColor"
        d="M2.5 2.5h11A1.5 1.5 0 0 1 15 4v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12V4a1.5 1.5 0 0 1 1.5-1.5Zm0 1.5v1.2h11V4h-11Zm0 2.7V12h11V6.7h-11ZM4 8h5v1H4V8Zm0 2h7v1H4v-1Z"
      />
    </svg>
  );
}

export function BottomToolWindow() {
  const t = useT();
  const bottomToolWindow = useAppStore((s) => s.bottomToolWindow);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const toggleBottomToolWindow = useAppStore((s) => s.toggleBottomToolWindow);
  const vcsConsoleOutput = useAppStore((s) => s.vcsConsoleOutput);
  const clearVcsOutput = useAppStore((s) => s.clearVcsOutput);

  const activeTab: BottomTab = bottomToolWindow ?? "vcsConsole";

  const tabs: ReadonlyArray<TabItem<BottomTab>> = [
    {
      id: "terminal",
      label: (
        <span className="jb-bottom-tab-label">
          <TerminalIcon />
          {t("bottom.terminalTab")}
        </span>
      ),
    },
    {
      id: "vcsConsole",
      label: (
        <span className="jb-bottom-tab-label">
          <ConsoleIcon />
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
          className="min-w-0 flex-1 border-b-0"
        />
        <div className="jb-bottom-tab-actions flex shrink-0 items-center gap-1 pr-2">
          {activeTab === "vcsConsole" && (
            <button
              type="button"
              className="jb-toolbar-icon-btn"
              title={t("bottom.clear")}
              onClick={clearVcsOutput}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path
                  fill="currentColor"
                  d="M6.5 2h3l.5 1H13v1.5H3V3h2.5l.5-1Zm-2 3.5h7l-.6 7.1A1.5 1.5 0 0 1 9.4 14H6.6a1.5 1.5 0 0 1-1.5-1.4L4.5 5.5Z"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="jb-toolbar-icon-btn"
            title={t("common.close")}
            onClick={() => toggleBottomToolWindow(activeTab)}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path
                fill="currentColor"
                d="M4.3 3.24 8 6.94l3.7-3.7 1.06 1.06L9.06 8l3.7 3.7-1.06 1.06L8 9.06l-3.7 3.7-1.06-1.06L6.94 8l-3.7-3.7L4.3 3.24Z"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="jb-bottom-content min-h-0 flex-1 overflow-hidden">
        {activeTab === "terminal" && <TerminalPanel className="h-full" />}
        {activeTab === "vcsConsole" && (
          <pre className="jb-vcs-console h-full overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
            {vcsConsoleOutput || (
              <span className="jb-text-dim">{t("bottom.vcsPlaceholder")}</span>
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
