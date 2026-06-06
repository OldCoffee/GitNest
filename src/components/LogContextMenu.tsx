import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";

interface LogContextMenuProps {
  commitHash: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function LogContextMenu({ commitHash, x, y, onClose }: LogContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [onClose]);

  async function run(label: string, action: () => Promise<{ output: string }>) {
    setBottomToolWindow("vcsConsole");
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["log"] });
      await queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] });
    } catch (e) {
      appendVcsOutput(String(e));
    }
    onClose();
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 280),
  };

  return (
    <div ref={menuRef} className="jb-context-menu" style={menuStyle}>
      <button
        type="button"
        className="jb-context-menu-item"
        onClick={() => void run(t("logMenu.cherryPickAction"), () => api.gitCherryPick(commitHash))}
      >
        <span>{t("logMenu.cherryPick")}</span>
      </button>
      <button
        type="button"
        className="jb-context-menu-item"
        onClick={() => void run(t("logMenu.revertAction"), () => api.gitRevert(commitHash))}
      >
        <span>{t("logMenu.revert")}</span>
      </button>
      <div className="jb-context-menu-separator" />
      <button
        type="button"
        className="jb-context-menu-item"
        onClick={() => void run(t("logMenu.resetSoftAction"), () => api.gitReset("soft", commitHash))}
      >
        <span>{t("logMenu.resetSoft")}</span>
      </button>
      <button
        type="button"
        className="jb-context-menu-item"
        onClick={() => void run(t("logMenu.resetMixedAction"), () => api.gitReset("mixed", commitHash))}
      >
        <span>{t("logMenu.resetMixed")}</span>
      </button>
      <button
        type="button"
        className="jb-context-menu-item"
        onClick={() => void run(t("logMenu.resetHardAction"), () => api.gitReset("hard", commitHash))}
      >
        <span>{t("logMenu.resetHard")}</span>
      </button>
    </div>
  );
}
