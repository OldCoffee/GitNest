import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { importTargetFromEntry, refreshProjectTree } from "../lib/projectTreeActions";
import type { ProjectEntry, ProjectTreeRow } from "../lib/types";
import { cn, repoName } from "../lib/utils";
import { useAppStore } from "../store/appStore";
import { ProjectTreeProvider, useProjectTree } from "../context/ProjectTreeContext";
import { useT } from "../context/PreferencesContext";
import { useProjectFileImport } from "../hooks/useProjectFileImport";
import { ProjectContextMenu } from "./ProjectContextMenu";
import { EmptyState, Loading, Panel, ToolWindowHeader } from "./ui";

function isHiddenByCollapsedAncestor(path: string, collapsed: ReadonlySet<string>): boolean {
  for (const collapsedPath of collapsed) {
    if (path.startsWith(`${collapsedPath}/`)) {
      return true;
    }
  }
  return false;
}

function filterVisibleRows(rows: ProjectTreeRow[], collapsed: ReadonlySet<string>): ProjectTreeRow[] {
  if (collapsed.size === 0) return rows;
  return rows.filter((row) => !isHiddenByCollapsedAncestor(row.path, collapsed));
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5H12a4 4 0 0 0-7.5 2.2L3.5 8.5 2 7l2.5-2.2A5.5 5.5 0 0 1 8 2.5Zm0 11a4.5 4.5 0 0 0 4.5-3.7H11a3 3 0 0 1-5.5-1.3l1.25 1.2L5 11.5l1.5 1.5 1.25-1.2A4.5 4.5 0 0 0 8 13.5Z"
      />
    </svg>
  );
}

function ProjectHeaderActions({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const t = useT();
  const { expandAll, collapseAll, locateActiveFile } = useProjectTree();

  return (
    <div className="jb-project-toolbar">
      <button
        type="button"
        className={cn("jb-project-toolbar-btn", refreshing && "jb-project-toolbar-btn-active")}
        title={t("projectToolbar.refresh")}
        aria-label={t("projectToolbar.refresh")}
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshIcon />
      </button>
      <button
        type="button"
        className="jb-project-toolbar-btn"
        title={t("projectToolbar.locate")}
        aria-label={t("projectToolbar.locate")}
        onClick={locateActiveFile}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path
            fill="currentColor"
            d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5c0 1.9-1 3.57-2.5 4.5L8 14.5l-3-2a5.5 5.5 0 1 1 7-7Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.75a.75.75 0 0 1 .75.75v1.69l1.22.7-.75 1.3L7.25 8.8V6.5a.75.75 0 0 1 .75-.75Z"
          />
        </svg>
      </button>
      <button
        type="button"
        className="jb-project-toolbar-btn"
        title={t("projectToolbar.expandAll")}
        aria-label={t("projectToolbar.expandAll")}
        onClick={expandAll}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path
            fill="currentColor"
            d="M4 6.5 8 2.5l4 4H9.5V9H6.5V6.5H4Zm0 3 4 4 4-4h-2.5V7H9.5v2.5H4Z"
          />
        </svg>
      </button>
      <button
        type="button"
        className="jb-project-toolbar-btn"
        title={t("projectToolbar.collapseAll")}
        aria-label={t("projectToolbar.collapseAll")}
        onClick={collapseAll}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path
            fill="currentColor"
            d="M4 9.5 8 5.5l4 4H9.5V13H6.5V9.5H4Zm0-3 4-4 4 4h-2.5V7H9.5V3H4Z"
          />
        </svg>
      </button>
    </div>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="jb-project-icon" viewBox="0 0 16 16" aria-hidden>
      {open ? (
        <path
          fill="currentColor"
          d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v6.8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7V7H2V4.5Z"
        />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="jb-project-icon" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm5.5 0V5.5H13L9.5 2Z"
      />
    </svg>
  );
}

const ProjectTreeNode = memo(function ProjectTreeNode({
  entry,
  depth,
  onContextMenu,
}: {
  entry: ProjectEntry;
  depth: number;
  onContextMenu: (entry: ProjectEntry, x: number, y: number) => void;
}) {
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const { isExpanded, setExpanded, selectedPath, locateSeq, registerRow } = useProjectTree();
  const rowRef = useRef<HTMLButtonElement>(null);
  const expanded = isExpanded(entry.path, entry.is_dir);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["project-entries", entry.path],
    queryFn: () => api.listProjectEntries(entry.path),
    enabled: entry.is_dir && expanded,
    staleTime: 0,
  });

  useEffect(() => {
    registerRow(entry.path, rowRef.current);
    return () => registerRow(entry.path, null);
  }, [entry.path, registerRow]);

  useEffect(() => {
    if (selectedPath === entry.path && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedPath, entry.path, locateSeq]);

  const openFile = useCallback(() => {
    setProjectImportTarget(importTargetFromEntry(entry));
    if (entry.is_dir) {
      setExpanded(entry.path, !expanded);
      return;
    }
    openFileEditor(entry.path);
  }, [entry, expanded, openFileEditor, setExpanded, setProjectImportTarget]);

  return (
    <div>
      <button
        ref={rowRef}
        type="button"
        className={cn(
          "jb-project-row",
          expanded && entry.is_dir && "jb-project-row-open",
          entry.git_ignored && "jb-project-row-ignored",
          selectedPath === entry.path && "jb-project-row-selected",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={openFile}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(entry, e.clientX, e.clientY);
        }}
        title={entry.path}
      >
        {entry.is_dir ? (
          <>
            <span className={cn("jb-project-chevron", expanded && "jb-project-chevron-open")}>
              ▸
            </span>
            <FolderIcon open={expanded} />
          </>
        ) : (
          <>
            <span className="jb-project-chevron-spacer" />
            <FileIcon />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {entry.is_dir && expanded && (
        <div>
          {isLoading && <Loading className="py-1 pl-8 text-xs" />}
          {!isLoading && children.length === 0 && (
            <div className="py-1 pl-8 text-xs jb-text-dim">—</div>
          )}
          {children.map((child) => (
            <ProjectTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const VirtualProjectRow = memo(function VirtualProjectRow({
  row,
  selected,
  onContextMenu,
  onOpen,
  onToggleDir,
  folderOpen,
}: {
  row: ProjectTreeRow;
  selected: boolean;
  folderOpen: boolean;
  onContextMenu: (entry: ProjectEntry, x: number, y: number) => void;
  onOpen: (row: ProjectTreeRow) => void;
  onToggleDir: (path: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "jb-project-row",
        folderOpen && row.is_dir && "jb-project-row-open",
        row.git_ignored && "jb-project-row-ignored",
        selected && "jb-project-row-selected",
      )}
      style={{ paddingLeft: `${row.depth * 14 + 8}px` }}
      onClick={() => (row.is_dir ? onToggleDir(row.path) : onOpen(row))}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(row, e.clientX, e.clientY);
      }}
      title={row.path}
    >
      {row.is_dir ? (
        <>
          <span className={cn("jb-project-chevron", folderOpen && "jb-project-chevron-open")}>
            ▸
          </span>
          <FolderIcon open={folderOpen} />
        </>
      ) : (
        <>
          <span className="jb-project-chevron-spacer" />
          <FileIcon />
        </>
      )}
      <span className="truncate">{row.name}</span>
    </button>
  );
});

function VirtualProjectTree({
  rows,
  onContextMenu,
}: {
  rows: ProjectTreeRow[];
  onContextMenu: (entry: ProjectEntry, x: number, y: number) => void;
}) {
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const { selectedPath, locateSeq, collapsedInAllMode, toggleFolderInAllMode } = useProjectTree();
  const parentRef = useRef<HTMLDivElement>(null);
  const visibleRows = useMemo(
    () => filterVisibleRows(rows, collapsedInAllMode),
    [rows, collapsedInAllMode],
  );

  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 24,
  });

  useEffect(() => {
    if (!selectedPath) return;
    const index = visibleRows.findIndex((row) => row.path === selectedPath);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "auto" });
    }
  }, [selectedPath, locateSeq, visibleRows]);

  const openFile = useCallback(
    (row: ProjectTreeRow) => {
      setProjectImportTarget(importTargetFromEntry(row));
      openFileEditor(row.path);
    },
    [openFileEditor, setProjectImportTarget],
  );

  const toggleDir = useCallback(
    (path: string) => {
      const row = visibleRows.find((r) => r.path === path);
      if (row) setProjectImportTarget(importTargetFromEntry(row));
      toggleFolderInAllMode(path);
    },
    [setProjectImportTarget, toggleFolderInAllMode, visibleRows],
  );

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-auto p-0"
      style={{ contain: "strict", overflowAnchor: "none" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = visibleRows[item.index];
          if (!row) return null;
          const folderOpen = row.is_dir && !collapsedInAllMode.has(row.path);
          return (
            <div
              key={row.path}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <VirtualProjectRow
                row={row}
                selected={selectedPath === row.path}
                folderOpen={folderOpen}
                onContextMenu={onContextMenu}
                onOpen={openFile}
                onToggleDir={toggleDir}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LazyProjectTree({
  onContextMenu,
}: {
  onContextMenu: (entry: ProjectEntry | null, x: number, y: number) => void;
}) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);

  const { data: rootEntries = [], isLoading, isFetching } = useQuery({
    queryKey: ["project-entries", ""],
    queryFn: () => api.listProjectEntries(null),
    enabled: !!repo,
    staleTime: 0,
  });

  return (
    <div
      className="min-h-0 flex-1 overflow-auto p-0"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".jb-project-row")) return;
        e.preventDefault();
        setProjectImportTarget(null);
        onContextMenu(null, e.clientX, e.clientY);
      }}
    >
      {repo && (
        <div className="jb-project-root px-3 py-2 text-xs jb-text-dim">
          {repoName(repo.path)}
        </div>
      )}
      {(isLoading || isFetching) && <Loading />}
      {!isLoading && rootEntries.length === 0 && (
        <EmptyState>{t("sidebar.noProjectFiles")}</EmptyState>
      )}
      {rootEntries.map((entry) => (
        <ProjectTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

function ProjectTreeBody({
  dropZoneRef,
  dragOver,
  refreshing,
}: {
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  dragOver: boolean;
  refreshing: boolean;
}) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const { expandMode } = useProjectTree();
  const [contextMenu, setContextMenu] = useState<{
    entry: ProjectEntry | null;
    x: number;
    y: number;
  } | null>(null);

  const { data: flatRows = [], isLoading: treeLoading, isFetching: treeFetching } = useQuery({
    queryKey: ["project-tree", repo?.path ?? ""],
    queryFn: () => api.listProjectTree(),
    enabled: !!repo && expandMode === "all",
    staleTime: 0,
  });

  const openContextMenu = useCallback((entry: ProjectEntry | null, x: number, y: number) => {
    setContextMenu({ entry, x, y });
  }, []);

  const treeBusy = treeLoading || treeFetching || refreshing;

  const treeContent =
    expandMode === "all" ? (
      treeBusy && flatRows.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-auto p-0">
          {repo && (
            <div className="jb-project-root px-3 py-2 text-xs jb-text-dim">
              {repoName(repo.path)}
            </div>
          )}
          <Loading />
        </div>
      ) : (
        <>
          {repo && (
            <div className="jb-project-root shrink-0 px-3 py-2 text-xs jb-text-dim">
              {repoName(repo.path)}
            </div>
          )}
          {flatRows.length === 0 ? (
            <EmptyState>{t("sidebar.noProjectFiles")}</EmptyState>
          ) : (
            <VirtualProjectTree rows={flatRows} onContextMenu={openContextMenu} />
          )}
        </>
      )
    ) : (
      <LazyProjectTree onContextMenu={openContextMenu} />
    );

  return (
    <>
      <div
        ref={dropZoneRef}
        className={cn(
          "jb-project-drop-zone flex min-h-0 flex-1 flex-col",
          dragOver && "jb-project-drop-zone-active",
        )}
        onContextMenu={(e) => {
          if (expandMode !== "all") return;
          if ((e.target as HTMLElement).closest(".jb-project-row")) return;
          e.preventDefault();
          setProjectImportTarget(null);
          openContextMenu(null, e.clientX, e.clientY);
        }}
      >
        {treeContent}
        {refreshing && (
          <div className="jb-project-refresh-overlay">
            <Loading className="text-xs" />
          </div>
        )}
        {dragOver && (
          <div className="jb-project-drop-overlay" aria-hidden>
            {t("projectMenu.dropHint")}
          </div>
        )}
      </div>
      {contextMenu &&
        createPortal(
          <ProjectContextMenu
            entry={contextMenu.entry}
            pasteParentPath={null}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />,
          document.body,
        )}
    </>
  );
}

function ProjectToolWindowInner() {
  const t = useT();
  const queryClient = useQueryClient();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { dragOver } = useProjectFileImport(dropZoneRef);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    void refreshProjectTree(queryClient)
      .catch((e) => window.alert(String(e)))
      .finally(() => setRefreshing(false));
  }, [queryClient, refreshing]);

  return (
    <Panel>
      <ToolWindowHeader
        title={t("sidebar.projectTitle")}
        actions={<ProjectHeaderActions onRefresh={onRefresh} refreshing={refreshing} />}
      />
      <ProjectTreeBody dropZoneRef={dropZoneRef} dragOver={dragOver} refreshing={refreshing} />
    </Panel>
  );
}

export function ProjectToolWindow() {
  return (
    <ProjectTreeProvider>
      <ProjectToolWindowInner />
    </ProjectTreeProvider>
  );
}
