import { open } from "@tauri-apps/plugin-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { endMeasure } from "../lib/performance";
import { importTargetFromEntry, refreshProjectTree } from "../lib/projectTreeActions";
import type { ProjectEntry, ProjectTreeRow } from "../lib/types";
import { uiAlert } from "../lib/uiPrompt";
import { cn, repoName } from "../lib/utils";
import { sameWorkspacePath, workspaceRootLabel } from "../lib/workspaceRoots";
import { useAppStore } from "../store/appStore";
import { ProjectTreeProvider, useProjectTree } from "../context/ProjectTreeContext";
import { useT } from "../context/PreferencesContext";
import { useProjectFileImport } from "../hooks/useProjectFileImport";
import { ProjectContextMenu } from "./ProjectContextMenu";
import { EmptyState, FileTypeIcon, IconButton, Loading, ToolWindowShell, TreeRow } from "./ui";
import {
  ChevronRightIcon,
  CollapseAllIcon,
  ExpandAllIcon,
  FolderIcon as FolderGlyph,
  LocateIcon,
  RefreshIcon,
} from "./ui/icons";

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

function ProjectHeaderActions({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const setWorkspaceRoots = useAppStore((s) => s.setWorkspaceRoots);
  const { expandAll, collapseAll, locateActiveFile } = useProjectTree();

  const addFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      const roots = await api.addWorkspaceFolder(selected);
      setWorkspaceRoots(roots);
      await refreshProjectTree(queryClient);
    } catch (error) {
      void uiAlert(String(error));
    }
  }, [queryClient, setWorkspaceRoots]);

  return (
    <div className="jb-project-toolbar">
      <IconButton
        surface="project"
        label={t("projectToolbar.addFolder")}
        onClick={() => void addFolder()}
      >
        <FolderGlyph open={false} size="sm" />
      </IconButton>
      <IconButton
        surface="project"
        className={cn(refreshing && "jb-project-toolbar-btn-active")}
        label={t("projectToolbar.refresh")}
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshIcon size="sm" />
      </IconButton>
      <IconButton surface="project" label={t("projectToolbar.locate")} onClick={locateActiveFile}>
        <LocateIcon size="sm" />
      </IconButton>
      <IconButton surface="project" label={t("projectToolbar.expandAll")} onClick={expandAll}>
        <ExpandAllIcon size="sm" />
      </IconButton>
      <IconButton surface="project" label={t("projectToolbar.collapseAll")} onClick={collapseAll}>
        <CollapseAllIcon size="sm" />
      </IconButton>
    </div>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return <FolderGlyph open={open} className="jb-project-icon" size="sm" />;
}

const ProjectTreeNode = memo(function ProjectTreeNode({
  entry,
  depth,
  workspaceRoot,
  onContextMenu,
}: {
  entry: ProjectEntry;
  depth: number;
  workspaceRoot?: string | null;
  onContextMenu: (entry: ProjectEntry, x: number, y: number) => void;
}) {
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const { isExpanded, setExpanded, selectedPath, locateSeq, registerRow } = useProjectTree();
  const rowRef = useRef<HTMLButtonElement>(null);
  const expanded = isExpanded(entry.path, entry.is_dir);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["project-entries", workspaceRoot ?? "", entry.path],
    queryFn: () => api.listProjectEntries(entry.path, workspaceRoot ?? null),
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
      <TreeRow
        ref={rowRef}
        depth={depth}
        indent={14}
        padBase={8}
        selected={selectedPath === entry.path}
        open={expanded && entry.is_dir}
        className={cn(
          "jb-project-row",
          expanded && entry.is_dir && "jb-project-row-open",
          entry.git_ignored && "jb-project-row-ignored",
          selectedPath === entry.path && "jb-project-row-selected",
        )}
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
              <ChevronRightIcon size="xs" />
            </span>
            <FolderIcon open={expanded} />
          </>
        ) : (
          <>
            <span className="jb-project-chevron-spacer" />
            <FileTypeIcon path={entry.path} className="jb-project-icon" size="sm" />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </TreeRow>
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
              workspaceRoot={workspaceRoot}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function WorkspaceRootSection({
  rootPath,
  allRoots,
  isActiveGit,
  onContextMenu,
}: {
  rootPath: string;
  allRoots: string[];
  isActiveGit: boolean;
  onContextMenu: (entry: ProjectEntry | null, x: number, y: number, rootPath?: string) => void;
}) {
  const t = useT();
  const label = workspaceRootLabel(rootPath, allRoots);
  const { isExpanded, setExpanded } = useProjectTree();
  const expanded = isExpanded(`__root__:${rootPath}`, true);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);

  const { data: rootEntries = [], isLoading } = useQuery({
    queryKey: ["project-entries", rootPath, ""],
    queryFn: () => api.listProjectEntries(null, rootPath),
    enabled: expanded,
    staleTime: 10_000,
  });

  const { data: isGitRoot = false } = useQuery({
    queryKey: ["is-git-repository", rootPath],
    queryFn: () => api.isGitRepository(rootPath),
    staleTime: 60_000,
  });

  const rootEntry: ProjectEntry = {
    name: label,
    path: rootPath,
    is_dir: true,
    git_ignored: false,
  };

  return (
    <div>
      <TreeRow
        depth={0}
        indent={14}
        padBase={8}
        open={expanded}
        className={cn("jb-project-row", expanded && "jb-project-row-open")}
        onClick={() => setExpanded(`__root__:${rootPath}`, !expanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setProjectImportTarget(null);
          onContextMenu(rootEntry, e.clientX, e.clientY, rootPath);
        }}
        title={rootPath}
      >
        <span className={cn("jb-project-chevron", expanded && "jb-project-chevron-open")}>
          <ChevronRightIcon size="xs" />
        </span>
        <FolderIcon open={expanded} />
        <span className="truncate font-medium">{label}</span>
        {isGitRoot && (
          <span className="ml-auto text-[10px] jb-text-dim">
            {isActiveGit ? t("projectMenu.activeGitBadge") : "git"}
          </span>
        )}
      </TreeRow>
      {expanded && (
        <div>
          {isLoading && <Loading className="py-1 pl-8 text-xs" />}
          {!isLoading &&
            rootEntries.map((entry) => (
              <ProjectTreeNode
                key={entry.path}
                entry={entry}
                depth={1}
                workspaceRoot={rootPath}
                onContextMenu={(entry, x, y) => onContextMenu(entry, x, y, rootPath)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

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
    <TreeRow
      depth={row.depth}
      indent={14}
      padBase={8}
      selected={selected}
      open={folderOpen && row.is_dir}
      className={cn(
        "jb-project-row",
        folderOpen && row.is_dir && "jb-project-row-open",
        row.git_ignored && "jb-project-row-ignored",
        selected && "jb-project-row-selected",
      )}
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
            <ChevronRightIcon size="xs" />
          </span>
          <FolderIcon open={folderOpen} />
        </>
      ) : (
        <>
          <span className="jb-project-chevron-spacer" />
          <FileTypeIcon path={row.path} className="jb-project-icon" size="sm" />
        </>
      )}
      <span className="truncate">{row.name}</span>
    </TreeRow>
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
  }, [selectedPath, locateSeq, visibleRows, virtualizer]);

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
      className="jb-project-scroll"
      style={{ overflowAnchor: "none" }}
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
  onContextMenu: (entry: ProjectEntry | null, x: number, y: number, rootPath?: string) => void;
}) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const workspaceRoots = useAppStore((s) => s.workspaceRoots);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const activeGitRoot = useAppStore((s) => s.activeGitRoot);
  const roots =
    workspaceRoots.length > 0 ? workspaceRoots : repo?.path ? [repo.path] : [];
  const multi = roots.length > 1;

  const primaryRoot = activeGitRoot ?? roots[0] ?? null;
  const { data: rootEntries = [], isLoading } = useQuery({
    queryKey: ["project-entries", primaryRoot ?? "", ""],
    queryFn: () => api.listProjectEntries(null, primaryRoot),
    enabled: !!repo && !multi,
    staleTime: 10_000,
  });
  const firstPaintDone = useRef(false);

  useEffect(() => {
    firstPaintDone.current = false;
  }, [repo?.path]);

  useEffect(() => {
    if (!repo || isLoading || firstPaintDone.current) return;
    if (multi) {
      firstPaintDone.current = true;
      requestAnimationFrame(() => endMeasure("project.firstPaint"));
      return;
    }
    firstPaintDone.current = true;
    requestAnimationFrame(() => {
      endMeasure("project.firstPaint");
    });
  }, [repo, isLoading, rootEntries.length, multi]);

  return (
    <div
      className="jb-project-scroll"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".jb-project-row")) return;
        e.preventDefault();
        setProjectImportTarget(null);
        onContextMenu(null, e.clientX, e.clientY, primaryRoot ?? undefined);
      }}
    >
      {!multi && repo && (
        <div className="jb-project-root px-3 py-2 text-xs jb-text-dim">
          {repoName(repo.path)}
        </div>
      )}
      {multi ? (
        roots.map((rootPath) => (
          <WorkspaceRootSection
            key={rootPath}
            rootPath={rootPath}
            allRoots={roots}
            isActiveGit={sameWorkspacePath(rootPath, primaryRoot ?? "")}
            onContextMenu={onContextMenu}
          />
        ))
      ) : (
        <>
          {isLoading && rootEntries.length === 0 && <Loading />}
          {!isLoading && rootEntries.length === 0 && (
            <EmptyState>{t("sidebar.noProjectFiles")}</EmptyState>
          )}
          {rootEntries.map((entry) => (
            <ProjectTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              workspaceRoot={primaryRoot}
              onContextMenu={(entry, x, y) => onContextMenu(entry, x, y, primaryRoot ?? undefined)}
            />
          ))}
        </>
      )}
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
  const workspaceRoots = useAppStore((s) => s.workspaceRoots);
  const [contextMenu, setContextMenu] = useState<{
    entry: ProjectEntry | null;
    x: number;
    y: number;
    rootPath?: string;
  } | null>(null);

  const { data: flatRows = [], isLoading: treeLoading, isFetching: treeFetching } = useQuery({
    queryKey: ["project-tree", repo?.path ?? "", workspaceRoots.join("|")],
    queryFn: () => api.listProjectTree(),
    enabled: !!repo && expandMode === "all",
    staleTime: 0,
  });

  const openContextMenu = useCallback(
    (entry: ProjectEntry | null, x: number, y: number, rootPath?: string) => {
      setContextMenu({ entry, x, y, rootPath });
    },
    [],
  );

  const treeBusy = treeLoading || treeFetching || refreshing;

  const treeContent =
    expandMode === "all" ? (
      treeBusy && flatRows.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-hidden p-0">
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
          "jb-project-drop-zone flex min-h-0 flex-1 flex-col overflow-hidden",
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
            workspaceRoot={contextMenu.rootPath ?? null}
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
      .catch((e) => void uiAlert(String(e)))
      .finally(() => setRefreshing(false));
  }, [queryClient, refreshing]);

  return (
    <ToolWindowShell
      className="min-h-0 flex-1"
      title={t("sidebar.projectTitle")}
      actions={<ProjectHeaderActions onRefresh={onRefresh} refreshing={refreshing} />}
      bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
    >
      <ProjectTreeBody dropZoneRef={dropZoneRef} dragOver={dragOver} refreshing={refreshing} />
    </ToolWindowShell>
  );
}

export function ProjectToolWindow() {
  return (
    <ProjectTreeProvider>
      <ProjectToolWindowInner />
    </ProjectTreeProvider>
  );
}
