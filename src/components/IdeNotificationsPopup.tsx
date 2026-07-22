import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { Badge, Button } from "./ui";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function IdeNotificationsPopup() {
  const t = useT();
  const open = useAppStore((s) => s.ideNotificationsOpen);
  const setOpen = useAppStore((s) => s.setIdeNotificationsOpen);
  const markRead = useAppStore((s) => s.markIdeNotificationsRead);
  const clearAll = useAppStore((s) => s.clearIdeNotifications);
  const notifications = useAppStore((s) => s.ideNotifications);
  const javaLspStatus = useAppStore((s) => s.javaLspStatus);
  const javaLspDetail = useAppStore((s) => s.javaLspDetail);
  const javaLspPercent = useAppStore((s) => s.javaLspPercent);
  const javaLspLog = useAppStore((s) => s.javaLspLog);
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;
    markRead();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        panelRef.current?.contains(target) ||
        target?.closest?.(".jb-status-notify-btn") ||
        target?.closest?.(".jb-status-lsp")
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, markRead, setOpen]);

  useEffect(() => {
    if (!open || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, javaLspLog, javaLspPercent]);

  if (!open) return null;

  const busy =
    javaLspStatus === "installing" ||
    javaLspStatus === "indexing" ||
    javaLspStatus === "starting";

  const statusLabel =
    javaLspStatus === "installing"
      ? t("fileEditor.lspInstalling")
      : javaLspStatus === "indexing"
        ? javaLspDetail || t("fileEditor.lspIndexing")
        : javaLspStatus === "starting"
          ? t("fileEditor.lspStarting")
          : javaLspStatus === "ready"
            ? t("fileEditor.lspIndexReady")
            : javaLspStatus === "error"
              ? javaLspDetail || t("fileEditor.lspUnavailable")
              : t("statusBar.notificationsEmptyLsp");

  const statusExtra =
    javaLspPercent != null && busy
      ? ` ${javaLspPercent}%`
      : javaLspStatus === "ready"
        ? " 100%"
        : "";

  const progressWidth =
    javaLspStatus === "ready"
      ? 100
      : javaLspPercent != null
        ? Math.max(2, Math.min(100, javaLspPercent))
        : javaLspStatus === "starting"
          ? 8
          : javaLspStatus === "installing"
            ? 20
            : busy
              ? 35
              : 0;

  return (
    <div ref={panelRef} className="jb-ide-notify-panel" role="dialog" aria-label={t("statusBar.notifications")}>
      <div className="jb-ide-notify-header">
        <span>{t("statusBar.notifications")}</span>
        <div className="jb-ide-notify-header-actions">
          <Button variant="toolbar" size="sm" onClick={() => clearAll()}>
            {t("statusBar.notificationsClear")}
          </Button>
          <Button variant="toolbar" size="sm" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </div>
      </div>

      <section className="jb-ide-notify-section">
        <div className="jb-ide-notify-section-title">{t("statusBar.lspDetails")}</div>
        <div className="jb-ide-notify-lsp-status">
          <div className="jb-ide-notify-lsp-row">
            <span className="jb-text-dim">{t("statusBar.lspStatus")}</span>
            {javaLspStatus === "error" ? (
              <Badge tone="error">
                {statusLabel}
                {statusExtra}
              </Badge>
            ) : (
              <span data-level={javaLspStatus === "ready" ? "ready" : busy ? "busy" : undefined}>
                {statusLabel}
                {statusExtra}
              </span>
            )}
          </div>
          {(busy || javaLspStatus === "ready") && (
            <div
              className={
                busy && javaLspPercent == null
                  ? "jb-ide-notify-lsp-bar jb-status-lsp-bar-indeterminate"
                  : "jb-ide-notify-lsp-bar"
              }
              aria-hidden
            >
              <span
                className="jb-ide-notify-lsp-bar-fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          )}
          {javaLspLog.length > 0 ? (
            <pre ref={logRef} className="jb-ide-notify-log">
              {javaLspLog.slice(-40).join("\n")}
            </pre>
          ) : (
            <p className="jb-text-dim text-xs">{t("statusBar.notificationsEmptyLog")}</p>
          )}
        </div>
      </section>

      <section className="jb-ide-notify-section">
        <div className="jb-ide-notify-section-title">{t("statusBar.notificationsList")}</div>
        {notifications.length === 0 ? (
          <p className="jb-text-dim px-3 py-2 text-xs">{t("statusBar.notificationsEmpty")}</p>
        ) : (
          <ul className="jb-ide-notify-list">
            {notifications.map((item) => (
              <li key={item.id} className="jb-ide-notify-item" data-level={item.level}>
                <div className="jb-ide-notify-item-head">
                  <span className="jb-ide-notify-source">{item.source}</span>
                  <span className="jb-text-dim">{formatTime(item.time)}</span>
                </div>
                <div className="jb-ide-notify-title">{item.title}</div>
                <div className="jb-ide-notify-message">{item.message}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
