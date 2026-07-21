import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "./ui";

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

  return (
    <ContextMenu
      menuRef={menuRef}
      style={{
        left: Math.min(x, window.innerWidth - 200),
        top: Math.min(y, window.innerHeight - 280),
      }}
    >
      <ContextMenuItem
        label={t("logMenu.cherryPick")}
        onClick={() => void run(t("logMenu.cherryPickAction"), () => api.gitCherryPick(commitHash))}
      />
      <ContextMenuItem
        label={t("logMenu.revert")}
        onClick={() => void run(t("logMenu.revertAction"), () => api.gitRevert(commitHash))}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("logMenu.resetSoft")}
        onClick={() => void run(t("logMenu.resetSoftAction"), () => api.gitReset("soft", commitHash))}
      />
      <ContextMenuItem
        label={t("logMenu.resetMixed")}
        onClick={() => void run(t("logMenu.resetMixedAction"), () => api.gitReset("mixed", commitHash))}
      />
      <ContextMenuItem
        label={t("logMenu.resetHard")}
        danger
        onClick={() => void run(t("logMenu.resetHardAction"), () => api.gitReset("hard", commitHash))}
      />
    </ContextMenu>
  );
}
