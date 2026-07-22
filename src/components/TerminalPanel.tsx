import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import { listen } from "@tauri-apps/api/event";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { api } from "../lib/api";
import {
  acceptCreatedSession,
  nextActiveAfterClose,
  pathBasename,
  removeTerminalSession,
  sessionsToCloseOnDispose,
} from "../lib/terminalSessions";
import { useT } from "../context/PreferencesContext";
import { useAppStore } from "../store/appStore";
import { CloseIcon, IconButton, PlusIcon, Tab, TabBar } from "./ui";
import "@xterm/xterm/css/xterm.css";

interface TerminalOutput {
  sessionId: number;
  data: number[];
}

export type TerminalPanelHandle = {
  clearActive: () => void;
};

export const TerminalPanel = forwardRef<TerminalPanelHandle, { className?: string }>(
  function TerminalPanel({ className }, ref) {
    const t = useT();
    const activeGitRoot = useAppStore((s) => s.activeGitRoot);
    const repoPath = useAppStore((s) => s.repo?.path ?? null);
    const pushIdeNotification = useAppStore((s) => s.pushIdeNotification);
    const [sessions, setSessions] = useState<number[]>([]);
    const [active, setActive] = useState<number | null>(null);
    const [exitedIds, setExitedIds] = useState<ReadonlySet<number>>(() => new Set());
    const [cwdById, setCwdById] = useState<Record<number, string>>({});
    const sessionsRef = useRef<number[]>([]);
    const disposedRef = useRef(false);
    const clearFnsRef = useRef(new Map<number, () => void>());
    const spawnCwdRef = useRef<string | null>(null);
    sessionsRef.current = sessions;
    spawnCwdRef.current = activeGitRoot ?? repoPath;

    const notifyCreateFailed = useCallback(
      (error: unknown) => {
        pushIdeNotification({
          level: "error",
          source: "Terminal",
          title: t("bottom.terminalCreateFailed"),
          message: String(error),
        });
      },
      [pushIdeNotification, t],
    );

    const notifyClipboardFailed = useCallback(() => {
      pushIdeNotification({
        level: "warning",
        source: "Terminal",
        title: t("bottom.clipboardFailed"),
        message: t("bottom.clipboardFailedHint"),
      });
    }, [pushIdeNotification, t]);

    useImperativeHandle(
      ref,
      () => ({
        clearActive: () => {
          if (active == null) return;
          clearFnsRef.current.get(active)?.();
        },
      }),
      [active],
    );

    useEffect(() => {
      let disposed = false;
      disposedRef.current = false;
      const cwd = spawnCwdRef.current;
      void api
        .terminalCreate({ cwd })
        .then((id) => {
          const { sessions: next, shouldClose } = acceptCreatedSession(
            sessionsRef.current,
            id,
            disposed || disposedRef.current,
          );
          if (shouldClose) {
            void api.terminalClose(id);
            return;
          }
          sessionsRef.current = next;
          setSessions(next);
          setActive(id);
          if (cwd) {
            setCwdById((prev) => ({ ...prev, [id]: cwd }));
          }
        })
        .catch((error) => {
          if (!disposed && !disposedRef.current) notifyCreateFailed(error);
        });
      return () => {
        disposed = true;
        disposedRef.current = true;
        const toClose = sessionsToCloseOnDispose(sessionsRef.current, []);
        sessionsRef.current = [];
        for (const session of toClose) void api.terminalClose(session);
      };
    }, [notifyCreateFailed]);

    async function createSession() {
      const cwd = spawnCwdRef.current;
      try {
        const id = await api.terminalCreate({ cwd });
        const { sessions: next, shouldClose } = acceptCreatedSession(
          sessionsRef.current,
          id,
          disposedRef.current,
        );
        if (shouldClose) {
          void api.terminalClose(id);
          return;
        }
        sessionsRef.current = next;
        setSessions(next);
        setActive(id);
        if (cwd) {
          setCwdById((prev) => ({ ...prev, [id]: cwd }));
        }
      } catch (error) {
        notifyCreateFailed(error);
      }
    }

    async function closeSession(id: number) {
      await api.terminalClose(id);
      setSessions((current) => {
        const next = removeTerminalSession(current, id);
        sessionsRef.current = next;
        setActive((prev) => nextActiveAfterClose(current, id, prev));
        return next;
      });
      setExitedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setCwdById((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      clearFnsRef.current.delete(id);
    }

    function markExited(id: number) {
      setExitedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }

    return (
      <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
        <TabBar variant="terminal" className="jb-terminal-tabs">
          {sessions.map((session, index) => {
            const cwd = cwdById[session];
            const exited = exitedIds.has(session);
            const label = exited
              ? `${t("bottom.terminalTab")} ${index + 1} (${t("bottom.terminalExited")})`
              : `${t("bottom.terminalTab")} ${index + 1}`;
            return (
              <Tab
                key={session}
                active={session === active}
                title={cwd ? pathBasename(cwd) : undefined}
                className={
                  [
                    session === active ? "jb-terminal-tab jb-terminal-tab-active" : "jb-terminal-tab",
                    exited ? "jb-terminal-tab-exited" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                onClick={() => setActive(session)}
              >
                {label}
                <IconButton
                  surface="tabClose"
                  label={t("bottom.closeTerminal")}
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeSession(session);
                  }}
                >
                  <CloseIcon size="xs" />
                </IconButton>
              </Tab>
            );
          })}
          <IconButton
            surface="terminalAdd"
            label={t("bottom.newTerminal")}
            onClick={() => void createSession()}
          >
            <PlusIcon size="xs" />
          </IconButton>
        </TabBar>
        <div className="relative min-h-0 flex-1">
          {sessions.map((session) => (
            <PtyTerminal
              key={session}
              sessionId={session}
              active={session === active}
              onExit={() => markExited(session)}
              onRegisterClear={(clear) => {
                clearFnsRef.current.set(session, clear);
              }}
              onClipboardError={notifyClipboardFailed}
            />
          ))}
        </div>
      </div>
    );
  },
);

function PtyTerminal({
  sessionId,
  active,
  onExit,
  onRegisterClear,
  onClipboardError,
}: {
  sessionId: number;
  active: boolean;
  onExit: () => void;
  onRegisterClear: (clear: () => void) => void;
  onClipboardError: () => void;
}) {
  const t = useT();
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const activeRef = useRef(active);
  const onExitRef = useRef(onExit);
  const onClipboardErrorRef = useRef(onClipboardError);
  const onRegisterClearRef = useRef(onRegisterClear);
  const searchOpenRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  activeRef.current = active;
  onExitRef.current = onExit;
  onClipboardErrorRef.current = onClipboardError;
  onRegisterClearRef.current = onRegisterClear;
  searchOpenRef.current = searchOpen;

  useEffect(() => {
    if (!terminalRef.current) return;

    const css = getComputedStyle(document.documentElement);
    const readVar = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;

    const term = new Terminal({
      theme: {
        background: readVar("--jb-term-bg", "#1a1e26"),
        foreground: readVar("--jb-term-fg", "#c4c8d0"),
        cursor: readVar("--jb-term-cursor", "#3d7eff"),
        selectionBackground: readVar("--jb-term-selection", "rgba(61, 126, 255, 0.45)"),
      },
      fontSize: 12,
      fontFamily: readVar("--jb-mono", "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"),
      convertEol: true,
      rightClickSelectsWord: true,
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.open(terminalRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;
    onRegisterClearRef.current(() => term.clear());

    const resize = () => {
      fit.fit();
      void api.terminalResize(sessionId, term.cols, term.rows);
    };
    const input = term.onData((data) => {
      void api.terminalWrite(sessionId, [...new TextEncoder().encode(data)]);
    });
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    void listen<TerminalOutput>("terminal-output", ({ payload }) => {
      if (payload.sessionId === sessionId) {
        term.write(new Uint8Array(payload.data));
      }
    }).then((dispose) => {
      unlistenOutput = dispose;
    });
    void listen<number>("terminal-exit", ({ payload }) => {
      if (payload === sessionId) {
        term.writeln("\r\n[process exited]");
        onExitRef.current();
      }
    }).then((dispose) => {
      unlistenExit = dispose;
    });

    async function copySelection() {
      const text = term.getSelection();
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        onClipboardErrorRef.current();
        return false;
      }
    }

    async function pasteClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) term.paste(text);
      } catch {
        onClipboardErrorRef.current();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeRef.current) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        if (event.key === "Escape" && searchOpenRef.current) {
          event.preventDefault();
          setSearchOpen(false);
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        event.stopPropagation();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }
      if (key === "c" || key === "с") {
        if (term.hasSelection()) {
          event.preventDefault();
          event.stopPropagation();
          void copySelection();
        }
        return;
      }
      if (key === "v") {
        event.preventDefault();
        event.stopPropagation();
        void pasteClipboard();
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (term.hasSelection()) {
        void copySelection();
      } else {
        void pasteClipboard();
      }
    };

    const host = terminalRef.current;
    host.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown, true);
      host.removeEventListener("contextmenu", onContextMenu);
      observer.disconnect();
      input.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
      term.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      fitRef.current?.fit();
      const term = termRef.current;
      if (term) {
        void api.terminalResize(sessionId, term.cols, term.rows);
        if (!searchOpen) term.focus();
      }
    });
  }, [active, sessionId, searchOpen]);

  useEffect(() => {
    if (searchOpen && active) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen, active]);

  function runFind(direction: "next" | "prev") {
    const query = searchQuery.trim();
    if (!query || !searchRef.current) return;
    if (direction === "next") {
      searchRef.current.findNext(query);
    } else {
      searchRef.current.findPrevious(query);
    }
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ display: active ? "flex" : "none" }}
    >
      {searchOpen && (
        <div className="jb-terminal-search flex shrink-0 items-center gap-1 px-2 py-1">
          <input
            ref={searchInputRef}
            className="jb-terminal-search-input min-w-0 flex-1"
            value={searchQuery}
            placeholder={t("bottom.terminalSearch")}
            aria-label={t("bottom.terminalSearch")}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runFind(event.shiftKey ? "prev" : "next");
              } else if (event.key === "Escape") {
                event.preventDefault();
                setSearchOpen(false);
                termRef.current?.focus();
              }
            }}
          />
          <button
            type="button"
            className="jb-terminal-search-btn"
            onClick={() => runFind("prev")}
          >
            {t("bottom.terminalSearchPrev")}
          </button>
          <button
            type="button"
            className="jb-terminal-search-btn"
            onClick={() => runFind("next")}
          >
            {t("bottom.terminalSearchNext")}
          </button>
        </div>
      )}
      <div ref={terminalRef} className="jb-terminal-host relative min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
