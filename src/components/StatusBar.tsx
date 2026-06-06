import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatProcessCpu, formatProcessMemory } from "../lib/processStats";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";

function MemoryIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M3 4.5h10A1.5 1.5 0 0 1 14.5 6v3A1.5 1.5 0 0 1 13 10.5H3A1.5 1.5 0 0 1 1.5 9V6A1.5 1.5 0 0 1 3 4.5Zm0 1.5v3h10V6H3Zm.5 5.5H5V13H3.5v-1.5Zm3.75 0h1.5V13h-1.5v-1.5Zm3.75 0H12.5V13H11v-1.5ZM4 7h1.5v1H4V7Zm3.25 0h1.5v1h-1.5V7ZM10.5 7H12v1h-1.5V7Z"
      />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M6 1.5h1V3H6V1.5Zm3 0h1V3H9V1.5ZM4.5 4.5h7v7h-7v-7Zm1.5 1.5v4h4V6H6Zm-4.5 0H3v1H1.5V6Zm0 3H3v1H1.5V9ZM13 6h1.5v1H13V6Zm0 3h1.5v1H13V9ZM6 13h1v1.5H6V13Zm3 0h1v1.5H9V13Z"
      />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Zm1.6 2.4 2.3 2.1-2.3 2.1-.9-1 1.2-1.1-1.2-1.1.9-1ZM8 9h3v1.2H8V9Z"
      />
    </svg>
  );
}

function ConsoleIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M2.5 2.5h11A1.5 1.5 0 0 1 15 4v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12V4a1.5 1.5 0 0 1 1.5-1.5Zm0 1.5v1.2h11V4h-11Zm0 2.7V12h11V6.7h-11ZM4 8h5v1H4V8Zm0 2h7v1H4v-1Z"
      />
    </svg>
  );
}

export function StatusBar() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const bottomToolWindow = useAppStore((s) => s.bottomToolWindow);
  const bottomExpanded = useAppStore((s) => s.bottomExpanded);
  const toggleBottomToolWindow = useAppStore((s) => s.toggleBottomToolWindow);

  const { data: processStats } = useQuery({
    queryKey: ["app-process-stats"],
    queryFn: api.getAppProcessStats,
    refetchInterval: 2000,
  });

  const { data: opState } = useQuery({
    queryKey: ["repo-operation-state"],
    queryFn: api.getRepoOperationState,
    refetchInterval: 5000,
    enabled: !!repo,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: api.getBranches,
    enabled: !!repo,
    staleTime: 2000,
  });

  const conflicts = opState?.conflict_count ?? 0;
  const currentLocal =
    branches.find((b) => !b.is_remote && b.is_current) ??
    branches.find((b) => !b.is_remote && b.name === repo?.branch);
  const incoming = currentLocal?.behind ?? 0;

  const isActive = (id: "terminal" | "vcsConsole") =>
    bottomExpanded && bottomToolWindow === id;

  return (
    <footer className="jb-footer flex shrink-0 items-center gap-3 px-3 py-0.5 text-xs">
      {repo && conflicts > 0 && (
        <span className="jb-status-conflicts">{t("statusBar.conflicts", { count: conflicts })}</span>
      )}

      <span className="flex-1" />

      {processStats && (
        <span className="jb-status-stats" title={t("statusBar.processStatsTitle")}>
          <span className="jb-status-stat">
            <MemoryIcon />
            {formatProcessMemory(processStats.memory_bytes)}
          </span>
          <span className="jb-status-stat">
            <CpuIcon />
            {formatProcessCpu(processStats.cpu_percent)}
          </span>
        </span>
      )}

      {repo && (
        <>
          <span className="jb-status-sep" />
          <span className={incoming > 0 ? "jb-text-accent" : "jb-text-dim"}>
            {t("statusBar.incoming")}: {incoming > 0 ? incoming : t("statusBar.incomingNone")}
          </span>
          <span className="jb-status-sep" />
          <button
            type="button"
            className="jb-status-toggle"
            data-active={isActive("terminal")}
            onClick={() => toggleBottomToolWindow("terminal")}
          >
            <TerminalIcon />
            {t("sidebar.terminal")}
          </button>
          <button
            type="button"
            className="jb-status-toggle"
            data-active={isActive("vcsConsole")}
            onClick={() => toggleBottomToolWindow("vcsConsole")}
          >
            <ConsoleIcon />
            {t("bottom.vcsConsole")}
          </button>
        </>
      )}
    </footer>
  );
}
