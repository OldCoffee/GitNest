import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatProcessCpu, formatProcessMemory } from "../lib/processStats";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { IdeNotificationsPopup } from "./IdeNotificationsPopup";
import { Button } from "./ui";
import { BellIcon, ConsoleIcon, CpuIcon, MemoryIcon, TerminalIcon } from "./ui/icons";

export function StatusBar() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const bottomToolWindow = useAppStore((s) => s.bottomToolWindow);
  const bottomExpanded = useAppStore((s) => s.bottomExpanded);
  const toggleBottomToolWindow = useAppStore((s) => s.toggleBottomToolWindow);
  const javaLspStatus = useAppStore((s) => s.javaLspStatus);
  const javaLspDetail = useAppStore((s) => s.javaLspDetail);
  const javaLspPercent = useAppStore((s) => s.javaLspPercent);
  const ideNotifications = useAppStore((s) => s.ideNotifications);
  const ideNotificationsOpen = useAppStore((s) => s.ideNotificationsOpen);
  const setIdeNotificationsOpen = useAppStore((s) => s.setIdeNotificationsOpen);

  const [statsReady, setStatsReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStatsReady(true), 8000);
    return () => window.clearTimeout(id);
  }, []);

  const { data: processStats } = useQuery({
    queryKey: ["app-process-stats"],
    queryFn: api.getAppProcessStats,
    refetchInterval: 8000,
    staleTime: 6000,
    enabled: statsReady,
  });

  const { data: opState } = useQuery({
    queryKey: ["repo-operation-state"],
    queryFn: api.getRepoOperationState,
    refetchInterval: 8000,
    staleTime: 4000,
    enabled: !!repo && statsReady,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: api.getBranches,
    enabled: !!repo && statsReady,
    staleTime: 5000,
  });

  const conflicts = opState?.conflict_count ?? 0;
  const currentLocal =
    branches.find((b) => !b.is_remote && b.is_current) ??
    branches.find((b) => !b.is_remote && b.name === repo?.branch);
  const incoming = currentLocal?.behind ?? 0;

  const isActive = (id: "terminal" | "vcsConsole") =>
    bottomExpanded && bottomToolWindow === id;

  const javaLspLabel =
    javaLspStatus === "installing"
      ? t("fileEditor.lspInstalling")
      : javaLspStatus === "indexing"
        ? javaLspDetail || t("fileEditor.lspIndexing")
        : javaLspStatus === "starting"
          ? t("fileEditor.lspStarting")
          : javaLspStatus === "ready"
            ? t("fileEditor.lspReady")
            : javaLspStatus === "error"
              ? javaLspDetail || t("fileEditor.lspUnavailable")
              : null;

  const showIndexProgress =
    javaLspStatus === "indexing" ||
    javaLspStatus === "installing" ||
    javaLspStatus === "starting";
  const progressWidth =
    javaLspPercent != null
      ? Math.max(2, Math.min(100, javaLspPercent))
      : javaLspStatus === "starting"
        ? 8
        : javaLspStatus === "installing"
          ? 20
          : 35;

  const unread = ideNotifications.filter((item) => !item.read).length;
  const hasErrors = ideNotifications.some((item) => item.level === "error" && !item.read);

  function openNotifications() {
    setIdeNotificationsOpen(!ideNotificationsOpen);
  }

  const lspLevel =
    javaLspStatus === "error" ? "error" : javaLspStatus === "ready" ? "ready" : "busy";

  return (
    <footer className="jb-footer relative flex shrink-0 items-center gap-3 px-3 py-0.5 text-xs">
      {repo && conflicts > 0 && (
        <span className="jb-status-conflicts">{t("statusBar.conflicts", { count: conflicts })}</span>
      )}

      {javaLspLabel && (
        <Button
          variant="statusLsp"
          data-level={lspLevel}
          title={t("statusBar.lspDetailsHint")}
          onClick={openNotifications}
        >
          <span className="jb-status-lsp-label truncate">
            {javaLspLabel}
            {javaLspPercent != null &&
            showIndexProgress &&
            !/\d+\s*%/.test(javaLspLabel)
              ? ` ${javaLspPercent}%`
              : ""}
          </span>
          {showIndexProgress && (
            <span
              className={
                javaLspPercent == null
                  ? "jb-status-lsp-bar jb-status-lsp-bar-indeterminate"
                  : "jb-status-lsp-bar"
              }
              aria-hidden
            >
              <span
                className="jb-status-lsp-bar-fill"
                style={javaLspPercent == null ? undefined : { width: `${progressWidth}%` }}
              />
            </span>
          )}
        </Button>
      )}

      <span className="flex-1" />

      {processStats && (
        <span className="jb-status-stats" title={t("statusBar.processStatsTitle")}>
          <span className="jb-status-stat">
            <MemoryIcon size="sm" />
            {formatProcessMemory(processStats.memory_bytes)}
          </span>
          <span className="jb-status-stat">
            <CpuIcon size="sm" />
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
          <Button
            variant="status"
            data-active={isActive("terminal")}
            onClick={() => toggleBottomToolWindow("terminal")}
          >
            <TerminalIcon size="sm" />
            {t("sidebar.terminal")}
          </Button>
          <Button
            variant="status"
            data-active={isActive("vcsConsole")}
            onClick={() => toggleBottomToolWindow("vcsConsole")}
          >
            <ConsoleIcon size="sm" />
            {t("bottom.vcsConsole")}
          </Button>
        </>
      )}

      <span className="jb-status-sep" />
      <Button
        variant="status"
        className="jb-status-notify-btn"
        data-active={ideNotificationsOpen}
        data-error={hasErrors || undefined}
        title={t("statusBar.notifications")}
        onClick={openNotifications}
      >
        <BellIcon size="sm" />
        {t("statusBar.notifications")}
        {unread > 0 && <span className="jb-status-notify-badge">{unread > 99 ? "99+" : unread}</span>}
      </Button>

      <IdeNotificationsPopup />
    </footer>
  );
}
