import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { CommitEntry, BranchInfo } from "../lib/types";
import { formatCommitDate } from "../lib/utils";
import { useBranches } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { BranchTreeView } from "./BranchTreeView";
import { DiffViewer } from "./DiffViewer";
import { LogContextMenu } from "./LogContextMenu";
import { cn } from "../lib/utils";
import { EmptyState, Loading, SearchInput, TabBar } from "./ui";

const PAGE_SIZE = 80;

const GRAPH_LANE_COUNT = 8;

function laneColor(lane: { color_index: number; color?: string }) {
  return lane.color ?? `var(--jb-graph-${(lane.color_index % GRAPH_LANE_COUNT) + 1})`;
}

export function LogEditor() {
  const t = useT();
  const [branch, setBranch] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ hash: string; x: number; y: number } | null>(
    null,
  );
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useBranches(true);
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["log-count", branch],
    queryFn: () => api.getLogCount(branch),
  });

  function selectLogBranch(selectedBranch: BranchInfo) {
    setBranch(selectedBranch.name);
  }

  const loadMore = useCallback(
    async (reset = false) => {
      const skip = reset ? 0 : commits.length;
      if (!reset && skip >= totalCount) return;
      setLoading(true);
      try {
        const batch = await api.getLog(branch, skip, PAGE_SIZE);
        setCommits((prev) => (reset ? batch : [...prev, ...batch]));
      } finally {
        setLoading(false);
      }
    },
    [branch, commits.length, totalCount],
  );

  useEffect(() => {
    setCommits([]);
    void loadMore(true);
  }, [branch]); // eslint-disable-line react-hooks/exhaustive-deps

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem) return;
    if (lastItem.index >= commits.length - 10 && !loading && commits.length < totalCount) {
      void loadMore();
    }
  }, [lastItem, commits.length, totalCount, loading, loadMore]);

  async function selectCommit(hash: string) {
    setSelectedHash(hash);
    try {
      const files = await api.getCommitChangedFiles(hash);
      setChangedFiles(files);
      setPreviewPath(files[0] ?? null);
    } catch {
      setChangedFiles([]);
      setPreviewPath(null);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="jb-log-sidebar">
        <div className="jb-border-b shrink-0 p-2">
          <SearchInput
            placeholder={t("editor.filterBranches")}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={cn(
            "jb-branch-tree-row px-2",
            branch === null && "jb-branch-tree-branch-selected",
          )}
          onClick={() => setBranch(null)}
        >
          <span className="jb-branch-tree-spacer" />
          <span className="jb-branch-tree-label">{t("editor.allCommits")}</span>
        </button>
        <div className="min-h-0 flex-1 overflow-auto">
          <BranchTreeView
            branches={branches}
            mode="local"
            filter={branchFilter}
            selectedName={branch}
            onSelect={selectLogBranch}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualItems.map((item) => {
              const commit = commits[item.index];
              const lanes = commit.graph_row.lanes;
              return (
                <div
                  key={commit.hash}
                  className={cn(
                    "jb-log-row",
                    selectedHash === commit.hash && "jb-log-row-selected",
                  )}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${item.size}px`,
                    transform: `translateY(${item.start}px)`,
                  }}
                  onClick={() => void selectCommit(commit.hash)}
                  onDoubleClick={() => void selectCommit(commit.hash)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ hash: commit.hash, x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="flex w-16 shrink-0 items-center gap-0.5 font-mono text-xs">
                    {lanes.map((lane, i) => (
                      <span
                        key={i}
                        style={{
                          color: laneColor(lane),
                          opacity: lane.active ? 1 : 0.35,
                        }}
                      >
                        {lane.active ? commit.graph_row.marker : "│"}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs jb-text-dim">{commit.short_hash}</span>
                      <span className="truncate text-xs">{commit.subject}</span>
                    </div>
                    <div className="text-xs jb-text-dim">
                      {commit.author} · {formatCommitDate(commit.date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {loading && <Loading className="p-2" />}
        </div>

        {selectedHash && (
          <div className="jb-border-t flex h-56 shrink-0 flex-col">
            {changedFiles.length > 0 && (
              <TabBar variant="preview">
                {changedFiles.map((file) => (
                  <button
                    key={file}
                    type="button"
                    className={cn(
                      "jb-tab max-w-48 truncate",
                      previewPath === file && "jb-tab-active",
                    )}
                    onClick={() => setPreviewPath(file)}
                    title={file}
                  >
                    {file.split("/").pop() ?? file}
                  </button>
                ))}
              </TabBar>
            )}
            {previewPath ? (
              <div className="min-h-0 flex-1">
                <DiffViewer
                  tab={{
                    id: `preview:${selectedHash}:${previewPath}`,
                    path: previewPath,
                    mode: "commit",
                    commitHash: selectedHash,
                  }}
                />
              </div>
            ) : (
              <EmptyState>{t("editor.noCommitFiles")}</EmptyState>
            )}
          </div>
        )}
      </div>
      {contextMenu && (
        <LogContextMenu
          commitHash={contextMenu.hash}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
