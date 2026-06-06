import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileChange } from "../lib/types";
import { EmptyState, StatusDot, ToolWindowHeader } from "./ui";
import { useT } from "../context/PreferencesContext";
import type { TranslateFn } from "../lib/i18n";
import { ChangeContextMenu } from "./ChangeContextMenu";

type DiffMode = "working" | "staged";

interface ContextMenuState {
  file: FileChange;
  mode: DiffMode;
  x: number;
  y: number;
}

type ListItem =
  | { kind: "header"; id: string; title: string }
  | { kind: "file"; id: string; file: FileChange; mode: DiffMode };

const FileRow = memo(function FileRow({
  file,
  mode,
  selected,
  onToggle,
  onOpen,
  onContextMenu,
  renderActions,
}: {
  file: FileChange;
  mode: DiffMode;
  selected: boolean;
  onToggle: (path: string) => void;
  onOpen: (file: FileChange, mode: DiffMode) => void;
  onContextMenu: (file: FileChange, mode: DiffMode, e: ReactMouseEvent) => void;
  renderActions?: (file: FileChange) => ReactNode;
}) {
  return (
    <div
      className="jb-list-row min-h-9"
      onContextMenu={(e) => onContextMenu(file, mode, e)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(file.path)}
      />
      <button
        type="button"
        onClick={() => onOpen(file, mode)}
        onDoubleClick={() => onOpen(file, mode)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
      >
        <StatusDot status={file.status} className="w-4 shrink-0" />
        <span className="truncate">{file.path}</span>
      </button>
      {renderActions?.(file)}
    </div>
  );
});

function buildItems(
  staged: FileChange[],
  unstaged: FileChange[],
  untracked: FileChange[],
  conflicted: FileChange[] = [],
  t: TranslateFn,
): ListItem[] {
  const items: ListItem[] = [];
  const pushSection = (title: string, files: FileChange[], mode: DiffMode) => {
    if (files.length === 0) return;
    items.push({ kind: "header", id: `header-${title}`, title });
    for (const file of files) {
      items.push({ kind: "file", id: `${mode}:${file.path}`, file, mode });
    }
  };
  pushSection(t("commit.conflicted"), conflicted, "working");
  pushSection(t("commit.staged"), staged, "staged");
  pushSection(t("commit.unstaged"), unstaged, "working");
  pushSection(t("commit.untracked"), untracked, "working");
  return items;
}

export function ChangesFileList({
  staged,
  unstaged,
  untracked,
  conflicted = [],
  selected,
  onToggle,
  onOpen,
  renderActions,
}: {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
  conflicted?: FileChange[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (file: FileChange, mode: DiffMode) => void;
  renderActions?: (file: FileChange) => ReactNode;
}) {
  const t = useT();
  const parentRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const items = useMemo(
    () => buildItems(staged, unstaged, untracked, conflicted, t),
    [staged, unstaged, untracked, conflicted, t],
  );

  const handleContextMenu = useCallback(
    (file: FileChange, mode: DiffMode, e: ReactMouseEvent) => {
      e.preventDefault();
      setMenu({ file, mode, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (items[index]?.kind === "header" ? 28 : 36),
    overscan: 12,
  });

  if (items.length === 0) {
    return <EmptyState className="block">{t("common.noChanges")}</EmptyState>;
  }

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-auto"
      style={{ contain: "strict", overflowAnchor: "none" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {item.kind === "header" ? (
                <ToolWindowHeader title={item.title} />
              ) : (
                <FileRow
                  file={item.file}
                  mode={item.mode}
                  selected={selected.has(item.file.path)}
                  onToggle={onToggle}
                  onOpen={onOpen}
                  onContextMenu={handleContextMenu}
                  renderActions={renderActions}
                />
              )}
            </div>
          );
        })}
      </div>
      {menu &&
        createPortal(
          <ChangeContextMenu
            file={menu.file}
            mode={menu.mode}
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
          />,
          document.body,
        )}
    </div>
  );
}

export function useSelectedPaths() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedPaths = useMemo(() => [...selected], [selected]);

  return { selected, selectedPaths, toggle, clear };
}
