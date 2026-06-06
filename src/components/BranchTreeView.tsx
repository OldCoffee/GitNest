import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { BranchInfo } from "../lib/types";
import { BranchContextMenu } from "./BranchContextMenu";
import {
  buildBranchTree,
  buildLocalBranchTree,
  buildPopupBranchTree,
  filterBranchTree,
  type BranchTreeNode,
} from "../lib/branchTree";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import type { TranslateFn } from "../lib/i18n";

function sectionLabel(node: BranchTreeNode, t: TranslateFn): string {
  if (node.kind === "section") {
    switch (node.id) {
      case "section:local":
        return t("branchTree.local");
      case "section:remote":
        return t("branchTree.remote");
      case "section:recent":
        return t("branchTree.recent");
      default:
        return node.label;
    }
  }
  if (node.kind === "folder") {
    return node.label;
  }
  return "";
}

function isTaggedBranch(name: string) {
  const base = name.includes("/") ? name.split("/").pop()! : name;
  return base === "master" || base === "main";
}

function isBranchCurrent(
  branch: BranchInfo,
  currentBranch: string | undefined,
  selectedRemote: string,
) {
  if (branch.is_current) return true;
  if (!currentBranch) return false;
  if (!branch.is_remote) return branch.name === currentBranch;
  return branch.name === `${selectedRemote}/${currentBranch}`;
}

function folderIdForBranch(name: string) {
  const slash = name.indexOf("/");
  return slash === -1 ? null : `folder:${name.slice(0, slash)}`;
}

function buildInitialExpanded(
  popup: boolean,
  expandDefault: boolean,
  filter: string,
  local: BranchInfo[],
  recentBranchNames: string[],
  currentBranch: string | undefined,
) {
  const ids = new Set<string>();
  if (popup) {
    ids.add("section:recent");
    ids.add("section:local");
    if (filter.trim()) ids.add("section:remote");
  } else if (expandDefault) {
    ids.add("section:local");
    ids.add("section:remote");
  }
  if (currentBranch) {
    const folderId = folderIdForBranch(currentBranch);
    if (folderId) ids.add(folderId);
  }
  if (filter.trim()) {
    for (const b of local) {
      const folderId = folderIdForBranch(b.name);
      if (folderId) ids.add(folderId);
    }
  }
  for (const name of recentBranchNames) {
    const folderId = folderIdForBranch(name);
    if (folderId) ids.add(folderId);
  }
  return ids;
}

function folderContainsCurrent(
  node: BranchTreeNode,
  currentBranch: string | undefined,
  selectedRemote: string,
) {
  if (node.kind !== "folder") return false;
  return node.children.some(
    (child) =>
      child.kind === "branch" &&
      isBranchCurrent(child.branch, currentBranch, selectedRemote),
  );
}

function BranchIcon({
  current,
  tagged,
}: {
  current?: boolean;
  tagged?: boolean;
}) {
  const checkoutBadge = current ? (
    <svg className="jb-branch-tree-icon-current-badge" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M11.75 3.25 8.25 6.75l-1.75-1.75-.75.75 2.5 2.5 4.75-4.75-.75-.75Z"
      />
    </svg>
  ) : null;

  if (current) {
    return (
      <span className="jb-branch-tree-icon-wrap">
        {tagged ? (
          <svg
            className="jb-branch-tree-icon jb-branch-tree-icon-tag"
            viewBox="0 0 16 16"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M3.5 2h4.2l.8.8 4.5 4.5V13a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-2H6v2a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
            />
          </svg>
        ) : (
          <svg className="jb-branch-tree-icon jb-branch-tree-icon-live" viewBox="0 0 16 16" aria-hidden>
            <path
              fill="currentColor"
              d="M4.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM5.5 7.5h5v1.5H9.8L8.5 12H6.7l1.3-3H5.5V7.5Z"
            />
          </svg>
        )}
        {checkoutBadge}
      </span>
    );
  }

  if (tagged) {
    return (
      <svg
        className="jb-branch-tree-icon jb-branch-tree-icon-tag"
        viewBox="0 0 16 16"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M3.5 2h4.2l.8.8 4.5 4.5V13a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-2H6v2a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
        />
      </svg>
    );
  }

  return (
    <svg className="jb-branch-tree-icon" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM5.5 7.5h5v1.5H9.8L8.5 12H6.7l1.3-3H5.5V7.5Z"
      />
    </svg>
  );
}

function IncomingIndicator({
  behind,
  upstream,
  t,
}: {
  behind: number;
  upstream?: string | null;
  t: TranslateFn;
}) {
  if (behind <= 0) return null;
  const title = upstream
    ? t("branchTree.behindUpstream", { upstream, count: behind })
    : t("branchTree.incomingChanges", { count: behind });
  return (
    <span className="jb-branch-tree-incoming" title={title} aria-label={title}>
      <svg className="jb-branch-tree-incoming-icon" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M10.75 3.25 6.5 7.5h2.25V12l-1.06-1.06L4.69 7.94 8.63 4l1.06 1.06V3.25h1.06Z"
        />
      </svg>
    </span>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="jb-branch-tree-icon" viewBox="0 0 16 16" aria-hidden>
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

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`jb-branch-tree-chevron ${open ? "jb-branch-tree-chevron-open" : ""}`}>
      ▸
    </span>
  );
}

function TreeNodeView({
  node,
  depth,
  expanded,
  toggle,
  selectedName,
  onSelect,
  onDelete,
  onContextMenu,
  busy,
  variant,
  currentBranchName,
  selectedRemote,
  localHasCurrent,
  t,
}: {
  node: BranchTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedName?: string | null;
  onSelect: (branch: BranchInfo) => void;
  onDelete?: (name: string) => void;
  onContextMenu?: (branch: BranchInfo, x: number, y: number) => void;
  busy?: boolean;
  variant: "default" | "popup";
  currentBranchName?: string;
  selectedRemote: string;
  localHasCurrent: boolean;
  t: TranslateFn;
}) {
  const indent = variant === "popup" ? 14 : 12;
  const pad = { paddingLeft: `${depth * indent + (variant === "popup" ? 8 : 4)}px` };
  const popup = variant === "popup";

  if (node.kind === "section" || node.kind === "folder") {
    const open = expanded.has(node.id);
    const isLocalSection = node.kind === "section" && node.id === "section:local";
    const folderHasCurrent = folderContainsCurrent(node, currentBranchName, selectedRemote);
    return (
      <div className={isLocalSection && localHasCurrent ? "jb-branch-tree-section-local" : undefined}>
        <button
          type="button"
          className={[
            "jb-branch-tree-row",
            "jb-branch-tree-folder",
            popup ? "jb-branch-tree-row-popup" : "",
            isLocalSection && localHasCurrent ? "jb-branch-tree-section-has-current" : "",
            folderHasCurrent ? "jb-branch-tree-folder-has-current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={pad}
          onClick={() => toggle(node.id)}
        >
          <Chevron open={open} />
          {node.kind === "folder" ? <FolderIcon open={open} /> : null}
          <span className="jb-branch-tree-label">{sectionLabel(node, t)}</span>
          {isLocalSection && localHasCurrent && (
            <span className="jb-branch-tree-section-current-hint">{currentBranchName}</span>
          )}
        </button>
        {open &&
          node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedName={selectedName}
              onSelect={onSelect}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              busy={busy}
              variant={variant}
              currentBranchName={currentBranchName}
              selectedRemote={selectedRemote}
              localHasCurrent={localHasCurrent}
              t={t}
            />
          ))}
      </div>
    );
  }

  const isCurrent = isBranchCurrent(node.branch, currentBranchName, selectedRemote);
  const isSelected = selectedName === node.branch.name;
  const tagged = isTaggedBranch(node.branch.name);

  return (
    <div
      className={[
        "jb-branch-tree-row",
        "jb-branch-tree-branch",
        popup ? "jb-branch-tree-row-popup" : "",
        isCurrent ? "jb-branch-tree-branch-current" : "",
        isSelected && !isCurrent ? "jb-branch-tree-branch-selected" : "",
        isSelected && isCurrent ? "jb-branch-tree-branch-current-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={pad}
      title={node.branch.name}
      onClick={() => {
        if (!busy && !isCurrent) onSelect(node.branch);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(node.branch, e.clientX, e.clientY);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !busy && !isCurrent) onSelect(node.branch);
      }}
    >
      <span className="jb-branch-tree-spacer" />
      <BranchIcon current={isCurrent} tagged={tagged} />
      <span className="jb-branch-tree-label">{node.displayName}</span>
      {!node.branch.is_remote && (
        <IncomingIndicator behind={node.branch.behind} upstream={node.branch.upstream} t={t} />
      )}
      {node.branch.upstream && (
        <span className="jb-branch-tree-upstream">{node.branch.upstream}</span>
      )}
      {!popup && node.branch.last_commit && (
        <span className="jb-branch-tree-hash">{node.branch.last_commit.slice(0, 7)}</span>
      )}
      {popup && onContextMenu && (
        <button
          type="button"
          className="jb-branch-tree-submenu"
          aria-label={t("branchTree.branchActions")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onContextMenu(node.branch, rect.right, rect.top);
          }}
        >
          ›
        </button>
      )}
      {!popup && !node.branch.is_remote && !isCurrent && onDelete && (
        <button
          type="button"
          className="jb-branch-tree-delete"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.branch.name);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function BranchTreeView({
  branches,
  mode = "both",
  variant = "default",
  recentBranchNames = [],
  filter = "",
  selectedName,
  onSelect,
  onDelete,
  showContextMenu = true,
  busy,
  defaultExpandedSections,
}: {
  branches: BranchInfo[];
  mode?: "both" | "local";
  variant?: "default" | "popup";
  recentBranchNames?: string[];
  filter?: string;
  selectedName?: string | null;
  onSelect: (branch: BranchInfo) => void;
  onDelete?: (name: string) => void;
  showContextMenu?: boolean;
  busy?: boolean;
  defaultExpandedSections?: boolean;
}) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const [contextMenu, setContextMenu] = useState<{
    branch: BranchInfo;
    x: number;
    y: number;
  } | null>(null);
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);
  const popup = variant === "popup";
  const expandDefault = defaultExpandedSections ?? !popup;
  const currentBranchName = repo?.branch;
  const localHasCurrent = local.some((b) =>
    isBranchCurrent(b, currentBranchName, selectedRemote),
  );

  const tree = useMemo(() => {
    if (popup) {
      return filterBranchTree(
        buildPopupBranchTree(local, remote, recentBranchNames),
        filter,
      );
    }
    const base =
      mode === "local"
        ? ([
            {
              kind: "section" as const,
              id: "section:local",
              label: "Local",
              children: buildLocalBranchTree(local),
            },
          ] satisfies BranchTreeNode[])
        : buildBranchTree(local, remote);
    return filterBranchTree(base, filter);
  }, [branches, filter, mode, local, remote, popup, recentBranchNames]);

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    buildInitialExpanded(
      popup,
      expandDefault,
      filter,
      local,
      recentBranchNames,
      currentBranchName,
    ),
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tree.length === 0) {
    return (
      <div className="px-3 py-2 text-xs jb-text-dim">{t("branchTree.noBranches")}</div>
    );
  }

  return (
    <>
      <div className={`jb-branch-tree ${popup ? "jb-branch-tree-popup" : ""}`}>
        {tree.map((node) => (
          <TreeNodeView
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            selectedName={selectedName}
            onSelect={onSelect}
            onDelete={onDelete}
            onContextMenu={
              showContextMenu && repo
                ? (branch, x, y) => setContextMenu({ branch, x, y })
                : undefined
            }
            busy={busy}
            variant={variant}
            currentBranchName={currentBranchName}
            selectedRemote={selectedRemote}
            localHasCurrent={localHasCurrent}
            t={t}
          />
        ))}
      </div>
      {contextMenu && repo &&
        createPortal(
          <BranchContextMenu
            branch={contextMenu.branch}
            currentBranch={repo.branch}
            selectedRemote={selectedRemote}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onBusyChange={(v) => {
              if (v) setContextMenu(null);
            }}
          />,
          document.body,
        )}
    </>
  );
}
