import { useQueryClient } from "@tanstack/react-query";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { api } from "../lib/api";
import { invalidateProjectTree, pasteIntoProject } from "../lib/projectTreeActions";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { uiAlert } from "../lib/uiPrompt";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("input, textarea, [contenteditable=true]");
}

export function useProjectFileImport(dropZoneRef: RefObject<HTMLElement | null>) {
  const t = useT();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const dragOverRef = useRef(false);

  const refreshTree = useCallback(() => {
    invalidateProjectTree(queryClient);
  }, [queryClient]);

  const importToTarget = useCallback(
    async (destDirPath: string | null, externalPaths?: string[]) => {
      const { projectClipboard, setProjectClipboard } = useAppStore.getState();
      if (externalPaths && externalPaths.length > 0) {
        await api.importExternalEntries(externalPaths, destDirPath);
        refreshTree();
        return true;
      }
      const pasted = await pasteIntoProject(destDirPath, projectClipboard, () =>
        setProjectClipboard(null),
      );
      if (pasted) refreshTree();
      return pasted;
    },
    [refreshTree],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      const webview = getCurrentWebview();
      unlisten = await webview.onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          const zone = dropZoneRef.current;
          if (!zone) return;
          const factor = await getCurrentWindow().scaleFactor();
          const x = payload.position.x / factor;
          const y = payload.position.y / factor;
          const rect = zone.getBoundingClientRect();
          const inside =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          dragOverRef.current = inside;
          setDragOver(inside);
        } else if (payload.type === "leave") {
          dragOverRef.current = false;
          setDragOver(false);
        } else if (payload.type === "drop") {
          const wasOver = dragOverRef.current;
          dragOverRef.current = false;
          setDragOver(false);
          if (!wasOver || payload.paths.length === 0) return;
          const dest = useAppStore.getState().projectImportTarget;
          try {
            await importToTarget(dest, payload.paths);
          } catch (e) {
            void uiAlert(String(e));
          }
        }
      });
      if (disposed) unlisten?.();
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [dropZoneRef, importToTarget]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isEditableTarget(e.target)) return;
      const { repo, leftToolWindow, leftPanelVisible, projectImportTarget } =
        useAppStore.getState();
      if (!repo || leftToolWindow !== "project" || !leftPanelVisible) return;

      const key = e.key.toLowerCase();
      if (key === "v") {
        e.preventDefault();
        void (async () => {
          try {
            const pasted = await importToTarget(projectImportTarget);
            if (!pasted) void uiAlert(t("projectMenu.pasteNothing"));
          } catch (err) {
            void uiAlert(String(err));
          }
        })();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [importToTarget, t]);

  return { dragOver, refreshTree };
}
