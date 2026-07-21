import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { EmptyState, Input, ListRow, Modal } from "./ui";

export type NavigationMode = "file" | "recent" | "line";

interface NavigationPaletteProps {
  mode: NavigationMode;
  onClose: () => void;
}

export function NavigationPalette({ mode, onClose }: NavigationPaletteProps) {
  const t = useT();
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const recentFiles = useAppStore((s) => s.recentFiles);
  const activeEditorTabId = useAppStore((s) => s.activeEditorTabId);
  const editorTabs = useAppStore((s) => s.editorTabs);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tree = [] } = useQuery({
    queryKey: ["project-tree"],
    queryFn: api.listProjectTree,
    enabled: mode === "file",
    staleTime: 30_000,
  });

  const files = useMemo(() => {
    if (mode === "recent") {
      const q = query.trim().toLowerCase();
      return recentFiles.filter((path) => !q || path.toLowerCase().includes(q));
    }
    const q = query.trim().toLowerCase();
    return tree
      .filter((row) => !row.is_dir)
      .map((row) => row.path)
      .filter((path) => !q || path.toLowerCase().includes(q))
      .slice(0, 200);
  }, [mode, query, recentFiles, tree]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);

  useEffect(() => {
    setSelected(0);
  }, [query, mode]);

  function openPath(path: string) {
    openFileEditor(path);
    onClose();
  }

  function goToLine(raw: string) {
    const line = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(line) || line < 1) return;
    const active = editorTabs.find((tab) => tab.id === activeEditorTabId);
    if (!active?.filePath) return;
    window.dispatchEvent(
      new CustomEvent("gitnest:goto-location", {
        detail: { path: active.filePath, line, column: 0 },
      }),
    );
    onClose();
  }

  const title =
    mode === "file"
      ? t("nav.goToFile")
      : mode === "recent"
        ? t("nav.recentFiles")
        : t("nav.goToLine");

  if (mode === "line") {
    return (
      <Modal title={title} onClose={onClose} className="jb-nav-palette">
        <Input
          ref={inputRef}
          className="jb-modal-input"
          placeholder={t("nav.linePlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goToLine(query);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose} className="jb-nav-palette">
      <Input
        ref={inputRef}
        className="jb-modal-input"
        placeholder={mode === "file" ? t("nav.filePlaceholder") : t("nav.recentPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((i) => Math.min(i + 1, Math.max(files.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const path = files[selected];
            if (path) openPath(path);
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
      />
      <div className="jb-nav-results">
        {files.length === 0 && <EmptyState className="jb-nav-empty">{t("nav.empty")}</EmptyState>}
        {files.map((path, index) => (
          <ListRow
            key={path}
            layout="stack"
            selected={index === selected}
            className={index === selected ? "jb-nav-item jb-nav-item-active" : "jb-nav-item"}
            onMouseEnter={() => setSelected(index)}
            onClick={() => openPath(path)}
          >
            <span className="jb-nav-item-name">{path.split("/").pop()}</span>
            <span className="jb-nav-item-path">{path}</span>
          </ListRow>
        ))}
      </div>
    </Modal>
  );
}
