import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useT } from "../context/PreferencesContext";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel({ className }: { className?: string }) {
  const t = useT();
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const css = getComputedStyle(document.documentElement);
    const readVar = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;

    const term = new Terminal({
      theme: {
        background: readVar("--jb-term-bg", "#2B2D30"),
        foreground: readVar("--jb-term-fg", "#BCBEC4"),
        cursor: readVar("--jb-term-cursor", "#3574F0"),
      },
      fontSize: 12,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();
    term.writeln(t("bottom.terminalHint"));
    xtermRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(terminalRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [t]);

  async function runCommand() {
    const cmd = command.trim();
    if (!cmd || running) return;
    setRunning(true);
    xtermRef.current?.writeln(`$ ${cmd}`);
    try {
      const result = await api.terminalRun(cmd);
      xtermRef.current?.write(result.replace(/\n/g, "\r\n"));
      xtermRef.current?.writeln("");
    } catch (e) {
      xtermRef.current?.writeln(String(e));
    } finally {
      setRunning(false);
      setCommand("");
      fitRef.current?.fit();
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <div ref={terminalRef} className="min-h-0 flex-1 overflow-hidden p-1" />
      <div className="jb-border-t flex shrink-0 gap-2 p-2">
        <input
          className="jb-input flex-1 font-mono text-xs"
          placeholder={t("bottom.shellCommand")}
          value={command}
          disabled={running}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runCommand();
          }}
        />
        <button
          type="button"
          className="jb-action-btn shrink-0"
          disabled={running || !command.trim()}
          onClick={() => void runCommand()}
        >
          {t("bottom.run")}
        </button>
      </div>
    </div>
  );
}
