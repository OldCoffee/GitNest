import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import type { CommitEntry } from "../lib/types";
import { cn, formatCommitDate } from "../lib/utils";
import { useT } from "../context/PreferencesContext";
import { Button, ChevronRightIcon, FileTypeIcon, FolderIcon, Loading, TreeRow } from "./ui";

interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: FileTreeNode[];
}

function buildFileTree(paths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const full of paths) {
    const parts = full.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      const path = parts.slice(0, idx + 1).join("/");
      let child = node.children.find((c) => c.name === part && c.isFile === isFile);
      if (!child) {
        child = { name: part, path, isFile, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  collapseSingleDirs(root);
  sortTree(root);
  return root;
}

// Collapse chains of single-child folders into one row (e.g. src/main/java).
function collapseSingleDirs(node: FileTreeNode) {
  for (const child of node.children) {
    while (!child.isFile && child.children.length === 1 && !child.children[0].isFile) {
      const only = child.children[0];
      child.name = `${child.name}/${only.name}`;
      child.path = only.path;
      child.children = only.children;
    }
    collapseSingleDirs(child);
  }
}

function sortTree(node: FileTreeNode) {
  node.children.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  node.children.forEach(sortTree);
}

function FileTreeRow({
  node,
  depth,
  collapsed,
  toggle,
  onOpenFile,
  selectedPath,
}: {
  node: FileTreeNode;
  depth: number;
  collapsed: Set<string>;
  toggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  selectedPath: string | null;
}) {
  const isOpen = !collapsed.has(node.path);
  return (
    <>
      <TreeRow
        depth={depth}
        indent={14}
        padBase={8}
        selected={node.isFile && selectedPath === node.path}
        open={!node.isFile && isOpen}
        className={cn(
          "jb-log-tree-row",
          node.isFile && selectedPath === node.path && "jb-log-tree-row-selected",
        )}
        onClick={() => (node.isFile ? onOpenFile(node.path) : toggle(node.path))}
        title={node.path}
      >
        {node.isFile ? (
          <>
            <span className="jb-log-tree-chevron-spacer" />
            <FileTypeIcon path={node.path} className="jb-log-tree-icon" size="sm" />
          </>
        ) : (
          <>
            <span className={cn("jb-log-tree-chevron", isOpen && "jb-log-tree-chevron-open")}>
              <ChevronRightIcon size="xs" />
            </span>
            <FolderIcon open={isOpen} className="jb-log-tree-icon" size="sm" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </TreeRow>
      {!node.isFile &&
        isOpen &&
        node.children.map((child) => (
          <FileTreeRow
            key={`${child.path}:${child.isFile}`}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            toggle={toggle}
            onOpenFile={onOpenFile}
            selectedPath={selectedPath}
          />
        ))}
    </>
  );
}

export function LogCommitDetail({
  commit,
  changedFiles,
  filesLoading,
  selectedPath,
  onOpenFile,
}: {
  commit: CommitEntry;
  changedFiles: string[];
  filesLoading: boolean;
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAllBranches, setShowAllBranches] = useState(false);

  const tree = useMemo(() => buildFileTree(changedFiles), [changedFiles]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-containing", commit.hash],
    queryFn: () => api.getBranchesContaining(commit.hash),
    staleTime: 30_000,
  });

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const branchLabel =
    branches.length === 1 ? t("logDetail.inBranch") : t("logDetail.inBranches", { count: branches.length });
  const shownBranches = showAllBranches ? branches : branches.slice(0, 3);

  return (
    <div className="jb-log-detail-inner">
      <div className="jb-log-detail-files">
        {filesLoading ? (
          <Loading className="p-3 text-xs" />
        ) : (
          tree.children.map((child) => (
            <FileTreeRow
              key={`${child.path}:${child.isFile}`}
              node={child}
              depth={0}
              collapsed={collapsed}
              toggle={toggle}
              onOpenFile={onOpenFile}
              selectedPath={selectedPath}
            />
          ))
        )}
      </div>

      <div className="jb-log-detail-meta">
        <div className="jb-log-detail-subject">{commit.subject}</div>
        {commit.body && <div className="jb-log-detail-body">{commit.body}</div>}
        <div className="jb-log-detail-author">
          <span className="jb-log-detail-hash">{commit.short_hash}</span>{" "}
          {commit.author}{" "}
          <span className="jb-text-dim">&lt;{commit.email}&gt;</span> {t("logDetail.on")}{" "}
          {formatCommitDate(commit.date)}
        </div>
        {branches.length > 0 && (
          <div className="jb-log-detail-branches">
            {branchLabel}:{" "}
            <span className="jb-text-dim">{shownBranches.join(", ")}</span>
            {branches.length > 3 && !showAllBranches && (
              <Button
                variant="ghost"
                size="sm"
                className="jb-log-detail-showall"
                onClick={() => setShowAllBranches(true)}
              >
                {t("logDetail.showAll")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
