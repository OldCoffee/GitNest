import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  acceptCreatedSession,
  nextActiveAfterClose,
  removeTerminalSession,
  sessionsToCloseOnDispose,
} from "../lib/terminalSessions";
import { useT } from "../context/PreferencesContext";
import { CloseIcon, IconButton, PlusIcon, Tab, TabBar } from "./ui";
import "@xterm/xterm/css/xterm.css";

interface TerminalOutput {
  sessionId: number;
  data: number[];
}

export function TerminalPanel({ className }: { className?: string }) {
  const t = useT();
  const [sessions, setSessions] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const sessionsRef = useRef<number[]>([]);
  const disposedRef = useRef(false);
  sessionsRef.current = sessions;

  useEffect(() => {
    let disposed = false;
    disposedRef.current = false;
    void api.terminalCreate().then((id) => {
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
    });
    return () => {
      disposed = true;
      disposedRef.current = true;
      const toClose = sessionsToCloseOnDispose(sessionsRef.current, []);
      sessionsRef.current = [];
      for (const session of toClose) void api.terminalClose(session);
    };
  }, []);

  async function createSession() {
    const id = await api.terminalCreate();
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
  }

  async function closeSession(id: number) {
    await api.terminalClose(id);
    setSessions((current) => {
      const next = removeTerminalSession(current, id);
      sessionsRef.current = next;
      setActive((prev) => nextActiveAfterClose(current, id, prev));
      return next;
    });
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <TabBar variant="terminal" className="jb-terminal-tabs">
        {sessions.map((session, index) => (
          <Tab
            key={session}
            active={session === active}
            className={
              session === active ? "jb-terminal-tab jb-terminal-tab-active" : "jb-terminal-tab"
            }
            onClick={() => setActive(session)}
          >
            {t("bottom.terminalTab")} {index + 1}
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
        ))}
        <IconButton surface="terminalAdd" label={t("bottom.newTerminal")} onClick={() => void createSession()}>
          <PlusIcon size="xs" />
        </IconButton>
      </TabBar>
      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => (
          <PtyTerminal key={session} sessionId={session} active={session === active} />
        ))}
      </div>
    </div>
  );
}

function PtyTerminal({ sessionId, active }: { sessionId: number; active: boolean }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Create xterm once per session — never recreate on active tab changes.
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
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

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
      if (payload === sessionId) term.writeln("\r\n[process exited]");
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
        return false;
      }
    }

    async function pasteClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) term.paste(text);
      } catch {
        // ignore clipboard permission errors
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeRef.current) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
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
      term.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    // Refit after becoming visible again (display:none zeroes layout).
    requestAnimationFrame(() => {
      fitRef.current?.fit();
      const term = termRef.current;
      if (term) {
        void api.terminalResize(sessionId, term.cols, term.rows);
        term.focus();
      }
    });
  }, [active, sessionId]);

  return (
    <div
      ref={terminalRef}
      className="jb-terminal-host absolute inset-0 overflow-hidden"
      style={{ display: active ? "block" : "none" }}
    />
  );
}
