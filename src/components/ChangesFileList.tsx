import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { FileChange, FileStatusKind } from "../lib/types";
import { Checkbox, EmptyState, ListRow, StatusDot } from "./ui";
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

interface Section {
  title: string;
  mode: DiffMode;
  files: FileChange[];
}

function FileStatusIcon({ status }: { status: FileStatusKind }) {
  return <StatusDot status={status} className={`jb-file-status jb-file-status-bg-${status}`} />;
}

function splitPath(path: string): { dir: string; name: string } {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return { dir: "", name: path };
  return { dir: path.slice(0, idx + 1), name: path.slice(idx + 1) };
}

function DiffStat({ file }: { file: FileChange }) {
  const add = file.additions;
  const del = file.deletions;
  if ((add == null || add === 0) && (del == null || del === 0)) return null;
  return (
    <span className="jb-file-stat">
      {add ? <span className="jb-file-stat-add">+{add}</span> : null}
      {del ? <span className="jb-file-stat-del">−{del}</span> : null}
    </span>
  );
}

const FileRow = memo(function FileRow({
  file,
  mode,
  selected,
  active,
  onToggle,
  onOpen,
  onContextMenu,
  renderActions,
}: {
  file: FileChange;
  mode: DiffMode;
  selected: boolean;
  active: boolean;
  onToggle: (path: string, e: ReactMouseEvent) => void;
  onOpen: (file: FileChange, mode: DiffMode) => void;
  onContextMenu: (file: FileChange, mode: DiffMode, e: ReactMouseEvent) => void;
  renderActions?: (file: FileChange) => ReactNode;
}) {
  const { dir, name } = splitPath(file.path);
  return (
    <div
      className={`jb-list-row jb-file-row${active ? " jb-list-row-selected" : ""}`}
      onContextMenu={(e) => onContextMenu(file, mode, e)}
      onClick={() => onOpen(file, mode)}
    >
      <Checkbox
        label=""
        className="jb-file-checkbox gap-0 shrink-0"
        checked={selected}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(file.path, e);
        }}
        onChange={() => {}}
      />
      <FileStatusIcon status={file.status} />
      <span className="jb-file-name">{name}</span>
      {dir && <span className="jb-file-dir">{dir}</span>}
      <DiffStat file={file} />
      {renderActions && (
        <span className="jb-file-actions" onClick={(e) => e.stopPropagation()}>
          {renderActions(file)}
        </span>
      )}
    </div>
  );
});

function GroupHeader({
  title,
  count,
  state,
  onToggle,
}: {
  title: string;
  count: number;
  state: "none" | "some" | "all";
  onToggle: () => void;
}) {
  return (
    <div className="jb-file-group-header">
      <span className="flex min-w-0 items-center gap-2">
        <Checkbox
          label=""
          ref={(el) => {
            if (el) el.indeterminate = state === "some";
          }}
          className="jb-file-checkbox gap-0 shrink-0"
          checked={state === "all"}
          onChange={onToggle}
        />
        <span className="jb-file-group-title truncate">{title}</span>
        <span className="jb-file-group-count">{count}</span>
      </span>
    </div>
  );
}

function buildSections(
  staged: FileChange[],
  unstaged: FileChange[],
  untracked: FileChange[],
  conflicted: FileChange[],
  t: TranslateFn,
): Section[] {
  const sections: Section[] = [];
  const push = (title: string, files: FileChange[], mode: DiffMode) => {
    if (files.length) sections.push({ title, files, mode });
  };
  push(t("commit.conflicted"), conflicted, "working");
  push(t("commit.staged"), staged, "staged");
  push(t("commit.unstaged"), unstaged, "working");
  push(t("commit.untracked"), untracked, "working");
  return sections;
}

export function ChangesFileList({
  staged,
  unstaged,
  untracked,
  conflicted = [],
  selected,
  onToggle,
  onToggleRange,
  onSetMany,
  onOpen,
  renderActions,
}: {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
  conflicted?: FileChange[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  onToggleRange?: (orderedPaths: string[], anchor: string, target: string) => void;
  onSetMany?: (paths: string[], value: boolean) => void;
  onOpen: (file: FileChange, mode: DiffMode) => void;
  renderActions?: (file: FileChange) => ReactNode;
}) {
  const t = useT();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const anchorRef = useRef<string | null>(null);

  const sections = useMemo(
    () => buildSections(staged, unstaged, untracked, conflicted, t),
    [staged, unstaged, untracked, conflicted, t],
  );

  const totalFiles = useMemo(
    () => sections.reduce((sum, section) => sum + section.files.length, 0),
    [sections],
  );
  const INITIAL_VISIBLE = 28;
  const LOAD_MORE = 40;
  const [visibleLimit, setVisibleLimit] = useState(() =>
    Math.min(INITIAL_VISIBLE, Math.max(totalFiles, 0) || INITIAL_VISIBLE),
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset on data change — do not auto-expand; expand only when the user scrolls.
    setVisibleLimit(Math.min(INITIAL_VISIBLE, totalFiles || INITIAL_VISIBLE));
  }, [totalFiles]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 80) return;
    setVisibleLimit((current) => {
      if (current >= totalFiles) return current;
      return Math.min(totalFiles, current + LOAD_MORE);
    });
  }, [totalFiles]);

  const orderedPaths = useMemo(
    () => sections.flatMap((s) => s.files.map((f) => f.path)),
    [sections],
  );

  const handleContextMenu = useCallback(
    (file: FileChange, mode: DiffMode, e: ReactMouseEvent) => {
      e.preventDefault();
      setMenu({ file, mode, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleToggle = useCallback(
    (path: string, e: ReactMouseEvent) => {
      if (e.shiftKey && anchorRef.current && onToggleRange) {
        onToggleRange(orderedPaths, anchorRef.current, path);
      } else {
        onToggle(path);
        anchorRef.current = path;
      }
    },
    [onToggle, onToggleRange, orderedPaths],
  );

  const handleOpen = useCallback(
    (file: FileChange, mode: DiffMode) => {
      setActivePath(file.path);
      onOpen(file, mode);
    },
    [onOpen],
  );

  const visibleSections = useMemo(() => {
    let remaining = visibleLimit;
    const out: Array<{ section: Section; files: FileChange[] }> = [];
    for (const section of sections) {
      if (remaining <= 0) break;
      const files = section.files.slice(0, remaining);
      remaining -= files.length;
      out.push({ section, files });
    }
    return out;
  }, [sections, visibleLimit]);

  if (sections.length === 0) {
    return <EmptyState className="block">{t("common.noChanges")}</EmptyState>;
  }

  return (
    <div
      ref={listRef}
      className="min-h-0 flex-1 overflow-auto"
      style={{ overflowAnchor: "none" }}
      onScroll={onScroll}
    >
      {visibleSections.map(({ section, files }) => {
          const paths = section.files.map((f) => f.path);
          const selectedCount = paths.filter((p) => selected.has(p)).length;
          const state: "none" | "some" | "all" =
            selectedCount === 0 ? "none" : selectedCount === paths.length ? "all" : "some";
          return (
            <div key={`${section.mode}:${section.title}`}>
              <GroupHeader
                title={section.title}
                count={section.files.length}
                state={state}
                onToggle={() => onSetMany?.(paths, state !== "all")}
              />
              {files.map((file) => (
                <FileRow
                  key={`${section.mode}:${file.path}`}
                  file={file}
                  mode={section.mode}
                  selected={selected.has(file.path)}
                  active={activePath === file.path}
                  onToggle={handleToggle}
                  onOpen={handleOpen}
                  onContextMenu={handleContextMenu}
                  renderActions={renderActions}
                />
              ))}
            </div>
          );
        })}
      {visibleLimit < totalFiles && (
        <ListRow
          className="text-xs opacity-70"
          onClick={() =>
            setVisibleLimit((current) => Math.min(totalFiles, current + LOAD_MORE))
          }
        >
          +{totalFiles - visibleLimit}
        </ListRow>
      )}
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

  const setMany = useCallback((paths: string[], value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of paths) {
        if (value) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }, []);

  const toggleRange = useCallback(
    (orderedPaths: string[], anchor: string, target: string) => {
      const a = orderedPaths.indexOf(anchor);
      const b = orderedPaths.indexOf(target);
      if (a < 0 || b < 0) return;
      const [from, to] = a <= b ? [a, b] : [b, a];
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) next.add(orderedPaths[i]);
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedPaths = useMemo(() => [...selected], [selected]);

  return { selected, selectedPaths, toggle, toggleRange, setMany, clear };
}
