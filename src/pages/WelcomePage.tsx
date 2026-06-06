import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { repoName } from "../lib/utils";
import { useAppStore } from "../store/appStore";
import { useRecentRepos } from "../hooks/useRepo";
import { Button, Input, Modal } from "../components/ui";
import { useT } from "../context/PreferencesContext";

function parentPath(path: string) {
  const normalized = path.replace(/[\\/]+$/, "");
  const slash = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return slash > 0 ? normalized.slice(0, slash) : normalized;
}

function repoNameFromCloneUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "repository";
  const withoutQuery = trimmed.split(/[?#]/, 1)[0].replace(/[\\/]+$/, "");
  const lastSeparator = Math.max(withoutQuery.lastIndexOf("/"), withoutQuery.lastIndexOf(":"));
  const rawName = (lastSeparator >= 0 ? withoutQuery.slice(lastSeparator + 1) : withoutQuery)
    .replace(/\.git$/i, "")
    .trim();
  const decoded = decodeURIComponent(rawName || "repository");
  return decoded.replace(/[\\/:*?"<>|]/g, "-") || "repository";
}

interface GitCloneOutputEvent {
  clone_id: string;
  stream: "stdout" | "stderr";
  chunk: string;
}

export function WelcomePage() {
  const t = useT();
  const setRepo = useAppStore((s) => s.setRepo);
  const { data: recent = [], refetch: refetchRecent } = useRecentRepos();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [clonePath, setClonePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneLog, setCloneLog] = useState("");
  const activeCloneIdRef = useRef<string | null>(null);
  const cloneCancelRequestedRef = useRef(false);
  const cloneLogRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const unlisten = listen<GitCloneOutputEvent>("git-clone-output", (event) => {
      if (event.payload.clone_id !== activeCloneIdRef.current) return;
      setCloneLog((prev) => `${prev}${event.payload.chunk.replace(/\r/g, "\n")}`);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    cloneLogRef.current?.scrollTo({
      top: cloneLogRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [cloneLog]);

  async function openExistingRepo(path: string) {
    const info = await api.openRepository(path);
    setRepo(info);
  }

  async function openPath(path: string) {
    setBusy(true);
    setOpeningPath(path);
    setOpenError(null);
    try {
      const hasGit = await api.isGitRepository(path);
      if (!hasGit) {
        const shouldInit = await confirm(t("welcome.initGitMessage", { path }), {
          title: t("welcome.initGitTitle"),
        });
        if (!shouldInit) return;
        await api.initGitRepository(path);
      }
      await openExistingRepo(path);
    } catch (e) {
      setOpenError(String(e));
    } finally {
      setBusy(false);
      setOpeningPath(null);
    }
  }

  async function clearRecentRepos() {
    const shouldClear = await confirm(t("welcome.clearRecentMessage"), {
      title: t("welcome.clearRecentTitle"),
    });
    if (!shouldClear) return;
    try {
      await api.clearRecentRepos();
      await refetchRecent();
    } catch (e) {
      setOpenError(String(e));
    }
  }

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await openPath(selected);
    }
  }

  async function pickClonePath() {
    const selected = await save({
      defaultPath: clonePath.trim() || repoNameFromCloneUrl(cloneUrl),
    });
    if (typeof selected === "string") setClonePath(selected);
  }

  async function handleClone() {
    if (!cloneUrl.trim() || !clonePath.trim()) return;
    const cloneId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = cloneUrl.trim();
    const path = clonePath.trim();
    setBusy(true);
    setCloneError(null);
    cloneCancelRequestedRef.current = false;
    setCloneLog(`$ git clone --progress ${url} ${path}\n`);
    activeCloneIdRef.current = cloneId;
    try {
      const result = await api.gitClone(url, path, cloneId);
      if (cloneCancelRequestedRef.current) {
        setCloneLog((prev) => `${prev}\n${t("welcome.cloneCanceled")}\n`);
        return;
      }
      if (!result.success) {
        setCloneError(result.output || t("welcome.cloneFailed"));
        return;
      }
      setCloneOpen(false);
      setCloneUrl("");
      setClonePath("");
      setCloneLog("");
      await openExistingRepo(path);
    } catch (e) {
      if (!cloneCancelRequestedRef.current) setCloneError(String(e));
    } finally {
      setBusy(false);
      activeCloneIdRef.current = null;
    }
  }

  async function handleCancelClone() {
    const cloneId = activeCloneIdRef.current;
    if (!cloneId) return;
    const confirmed = await confirm(t("welcome.cancelCloneMessage"), {
      title: t("welcome.cancelCloneTitle"),
    });
    if (!confirmed || activeCloneIdRef.current !== cloneId) return;
    cloneCancelRequestedRef.current = true;
    setCloneLog((prev) => `${prev}\n${t("welcome.cancelling")}\n`);
    try {
      await api.cancelClone(cloneId);
    } catch {
      // ignore: clone may have already finished
    }
  }

  return (
    <div className="jb-shell flex h-full flex-col items-center justify-center overflow-auto p-8">
      <div className="jb-welcome-hero">
        <div className="jb-welcome-logo-wrap">
          <img
            src="/gitnest-logo.svg"
            alt="GitNest"
            className="h-24 w-24"
            draggable={false}
          />
        </div>
        <h1 className="jb-welcome-title text-3xl">{t("welcome.title")}</h1>
        <p className="mt-3 max-w-xl jb-text-dim">{t("welcome.subtitle")}</p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" className="px-6 py-2" disabled={busy} onClick={pickFolder}>
          {t("welcome.openRepo")}
        </Button>
        <Button className="px-6 py-2" disabled={busy} onClick={() => setCloneOpen(true)}>
          {t("welcome.cloneRepo")}
        </Button>
        <Button className="px-6 py-2" onClick={() => void api.openNewWindow()}>
          {t("welcome.newWindow")}
        </Button>
      </div>

      {openError && (
        <div className="mt-4 max-w-xl text-center text-xs jb-text-error">{openError}</div>
      )}

      {recent.length > 0 && (
        <section className="jb-recent-panel mt-9 w-full max-w-2xl">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t("welcome.recent")}</h2>
              <p className="mt-1 text-xs jb-text-dim">{t("welcome.recentHint")}</p>
            </div>
            <Button className="shrink-0" disabled={busy} onClick={() => void clearRecentRepos()}>
              {t("welcome.clearRecent")}
            </Button>
          </div>
          <ul className="grid gap-2">
            {recent.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className="jb-recent-card"
                  disabled={busy}
                  onClick={() => void openPath(path)}
                >
                  <span className="jb-recent-icon" aria-hidden>
                    <svg viewBox="0 0 16 16">
                      <path
                        fill="currentColor"
                        d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v6.8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{repoName(path)}</span>
                    <span className="mt-0.5 block truncate text-xs jb-text-dim">
                      {parentPath(path)}
                    </span>
                  </span>
                  <span className="jb-recent-open">{t("welcome.openRecent")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openingPath && (
        <div className="jb-opening-overlay" role="status" aria-live="polite">
          <div className="jb-opening-card">
            <div className="jb-spinner" aria-hidden />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("welcome.openingWorkspace")}</div>
              <div className="mt-1 truncate text-xs jb-text-dim">{openingPath}</div>
              <div className="mt-2 text-xs jb-text-dim">{t("welcome.openingHint")}</div>
            </div>
          </div>
        </div>
      )}

      {cloneOpen && (
        <Modal
          title={t("welcome.cloneTitle")}
          onClose={() => {
            if (busy) return;
            setCloneOpen(false);
            setCloneError(null);
            setCloneLog("");
            activeCloneIdRef.current = null;
          }}
        >
          <label className="mb-3 block text-xs">
            <span className="jb-field-label">{t("welcome.repoUrl")}</span>
            <Input
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
            />
          </label>
          <label className="mb-4 block text-xs">
            <span className="jb-field-label">{t("welcome.destPath")}</span>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={clonePath}
                onChange={(e) => setClonePath(e.target.value)}
                placeholder="/path/to/clone"
              />
              <Button onClick={() => void pickClonePath()}>…</Button>
            </div>
          </label>
          {cloneError && <div className="mb-3 text-xs jb-text-error">{cloneError}</div>}
          {busy && !cloneError && (
            <div className="mb-3 text-xs jb-text-dim">{t("welcome.cloningHint")}</div>
          )}
          {(busy || cloneLog) && (
            <pre ref={cloneLogRef} className="jb-clone-log mb-3">
              {cloneLog || t("welcome.cloneLogPlaceholder")}
            </pre>
          )}
          <div className="flex justify-end gap-2">
            {busy ? (
              <Button onClick={() => void handleCancelClone()}>
                {t("welcome.cancelClone")}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setCloneOpen(false);
                  setCloneError(null);
                  setCloneLog("");
                  activeCloneIdRef.current = null;
                }}
              >
                {t("common.cancel")}
              </Button>
            )}
            <Button
              variant="primary"
              disabled={busy || !cloneUrl.trim() || !clonePath.trim()}
              onClick={() => void handleClone()}
            >
              {busy ? t("welcome.cloning") : t("welcome.clone")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
