import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { endMeasure, startMeasure } from "../lib/performance";
import type { CommitEntry, CommitRef, GraphRow } from "../lib/types";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/appStore";
import { useBranches } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { LogContextMenu } from "./LogContextMenu";
import { LogFilterDropdown } from "./LogFilterDropdown";
import { LogCommitDetail } from "./LogCommitDetail";
import { EmptyState, Button, Loading, SearchInput, TagIcon } from "./ui";

const PAGE_SIZE = 80;
const ALL_BRANCHES = "\u0000all";

const DETAIL_STORAGE_KEY = "rebased.logDetailWidth";
const DETAIL_MIN_WIDTH = 260;
const DETAIL_MAX_WIDTH = 720;
const DETAIL_DEFAULT_WIDTH = 360;

function readDetailWidth(): number {
  if (typeof window === "undefined") return DETAIL_DEFAULT_WIDTH;
  const raw = Number(localStorage.getItem(DETAIL_STORAGE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return DETAIL_DEFAULT_WIDTH;
  return Math.min(DETAIL_MAX_WIDTH, Math.max(DETAIL_MIN_WIDTH, raw));
}

const GRAPH_LANE_WIDTH = 16;
const GRAPH_ROW_HEIGHT = 44;
const GRAPH_NODE_RADIUS = 4;

function laneX(lane: number) {
  return lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2;
}

function anchorY(y: 0 | 1 | 2) {
  if (y === 0) return 0;
  if (y === 2) return GRAPH_ROW_HEIGHT;
  return GRAPH_ROW_HEIGHT / 2;
}

function CommitGraph({ row }: { row: GraphRow }) {
  const lanes = Math.max(row.width, row.node_lane + 1, 1);
  const width = lanes * GRAPH_LANE_WIDTH;
  const cx = laneX(row.node_lane);
  const cy = GRAPH_ROW_HEIGHT / 2;
  return (
    <svg
      className="jb-log-graph-svg"
      width={width}
      height={GRAPH_ROW_HEIGHT}
      style={{ width, minWidth: width }}
      aria-hidden="true"
    >
      {row.edges.map((e, i) => {
        const x1 = laneX(e.from_lane);
        const y1 = anchorY(e.from_y);
        const x2 = laneX(e.to_lane);
        const y2 = anchorY(e.to_y);
        const d =
          x1 === x2
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
        return <path key={i} d={d} stroke={e.color} strokeWidth={1.6} fill="none" />;
      })}
      <circle
        cx={cx}
        cy={cy}
        r={GRAPH_NODE_RADIUS}
        fill={row.is_merge ? "var(--jb-panel)" : row.node_color}
        stroke={row.node_color}
        strokeWidth={row.is_merge ? 1.8 : 1}
      />
    </svg>
  );
}

function formatLogDate(unix: number) {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RefBadge({ refItem }: { refItem: CommitRef }) {
  return (
    <span className={cn("jb-log-ref", `jb-log-ref-${refItem.kind}`)} title={refItem.name}>
      {refItem.kind === "tag" && (
        <span className="jb-log-ref-glyph">
          <TagIcon size="xs" />
        </span>
      )}
      {refItem.name}
    </span>
  );
}

interface ActiveFilters {
  branch: string | null;
  author: string | null;
  since: string | null;
  path: string;
}

export function LogEditor() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);

  const [filters, setFilters] = useState<ActiveFilters>({
    branch: null,
    author: null,
    since: null,
    path: "",
  });
  const [text, setText] = useState("");
  const [pathDraft, setPathDraft] = useState("");

  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ hash: string; x: number; y: number } | null>(
    null,
  );
  const parentRef = useRef<HTMLDivElement>(null);

  const [detailWidth, setDetailWidth] = useState(readDetailWidth);
  const [resizing, setResizing] = useState(false);
  const detailWidthRef = useRef(detailWidth);
  detailWidthRef.current = detailWidth;

  useEffect(() => {
    localStorage.setItem(DETAIL_STORAGE_KEY, String(detailWidth));
  }, [detailWidth]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const max = Math.min(DETAIL_MAX_WIDTH, window.innerWidth - 360);
      const next = Math.min(max, Math.max(DETAIL_MIN_WIDTH, window.innerWidth - e.clientX));
      setDetailWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const { data: branches = [] } = useBranches(!!repo);

  const branchArg = filters.branch === ALL_BRANCHES ? "--all" : filters.branch;
  const apiFilters = useMemo(
    () => ({ author: filters.author, since: filters.since, path: filters.path }),
    [filters.author, filters.since, filters.path],
  );

  const { data: authors = [] } = useQuery({
    queryKey: ["log-authors", branchArg],
    queryFn: () => api.getLogAuthors(branchArg),
    enabled: !!repo,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["log-count", branchArg, apiFilters],
    queryFn: () => api.getLogCount(branchArg, apiFilters),
    enabled: !!repo,
  });

  const firstPaintDone = useRef(false);

  const loadMore = useCallback(
    async (reset = false) => {
      const skip = reset ? 0 : commits.length;
      if (!reset && skip >= totalCount) return;
      setLoading(true);
      try {
        const batch = await api.getLog(branchArg, skip, PAGE_SIZE, apiFilters);
        setCommits((prev) => (reset ? batch : [...prev, ...batch]));
        if (reset && !firstPaintDone.current) {
          firstPaintDone.current = true;
          requestAnimationFrame(() => {
            endMeasure("log.firstPaint");
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [branchArg, apiFilters, commits.length, totalCount],
  );

  useEffect(() => {
    firstPaintDone.current = false;
    startMeasure("log.firstPaint");
    setCommits([]);
    setSelectedHash(null);
    void loadMore(true);
  }, [branchArg, apiFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCommits = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q),
    );
  }, [commits, text]);

  const virtualizer = useVirtualizer({
    count: filteredCommits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 16,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem || text.trim()) return;
    if (lastItem.index >= commits.length - 10 && !loading && commits.length < totalCount) {
      void loadMore();
    }
  }, [lastItem, commits.length, totalCount, loading, loadMore, text]);

  const selectedCommit = useMemo(
    () => commits.find((c) => c.hash === selectedHash) ?? null,
    [commits, selectedHash],
  );

  async function selectCommit(hash: string) {
    setSelectedHash(hash);
    setFilesLoading(true);
    try {
      const files = await api.getCommitChangedFiles(hash);
      setChangedFiles(files);
      setPreviewPath(null);
    } catch {
      setChangedFiles([]);
      setPreviewPath(null);
    } finally {
      setFilesLoading(false);
    }
  }

  function openFileDiff(path: string) {
    if (!selectedHash) return;
    setPreviewPath(path);
    openDiffEditor({
      id: `commit:${selectedHash}:${path}`,
      path,
      mode: "commit",
      commitHash: selectedHash,
    });
  }

  // ---- filter helpers ----
  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const branchLabel =
    filters.branch === ALL_BRANCHES
      ? t("logFilter.allBranches")
      : (filters.branch ?? repo?.branch ?? t("logFilter.allBranches"));
  const userLabel = filters.author ?? t("logFilter.allUsers");
  const dateOptions = [
    { value: null, label: t("logFilter.allTime") },
    { value: "1 day ago", label: t("logFilter.last24h") },
    { value: "1 week ago", label: t("logFilter.last7d") },
    { value: "1 month ago", label: t("logFilter.last30d") },
    { value: "3 months ago", label: t("logFilter.last3m") },
    { value: "1 year ago", label: t("logFilter.lastYear") },
  ];
  const dateLabel =
    dateOptions.find((o) => o.value === filters.since)?.label ?? t("logFilter.allTime");
  const pathLabel = filters.path || t("logFilter.allTime");

  const [userFilter, setUserFilter] = useState("");
  const shownAuthors = userFilter.trim()
    ? authors.filter((a) => a.toLowerCase().includes(userFilter.trim().toLowerCase()))
    : authors;

  return (
    <div className="jb-log-root">
      <div className="jb-log-toolbar">
        <div className="jb-log-search">
          <SearchInput
            placeholder={t("logFilter.searchPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <LogFilterDropdown
          label={t("logFilter.branch")}
          value={branchLabel}
          active={filters.branch !== null}
          width={260}
        >
          {(close) => (
            <div className="jb-log-filter-list">
              <button
                type="button"
                className={cn("jb-log-filter-item", filters.branch === null && "jb-log-filter-item-active")}
                onClick={() => {
                  setFilters((f) => ({ ...f, branch: null }));
                  close();
                }}
              >
                {repo?.branch ?? "HEAD"}
              </button>
              <button
                type="button"
                className={cn(
                  "jb-log-filter-item",
                  filters.branch === ALL_BRANCHES && "jb-log-filter-item-active",
                )}
                onClick={() => {
                  setFilters((f) => ({ ...f, branch: ALL_BRANCHES }));
                  close();
                }}
              >
                {t("logFilter.allBranches")}
              </button>
              {localBranches.length > 0 && (
                <div className="jb-log-filter-group">{t("logFilter.localBranches")}</div>
              )}
              {localBranches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={cn(
                    "jb-log-filter-item",
                    filters.branch === b.name && "jb-log-filter-item-active",
                  )}
                  onClick={() => {
                    setFilters((f) => ({ ...f, branch: b.name }));
                    close();
                  }}
                >
                  {b.name}
                </button>
              ))}
              {remoteBranches.length > 0 && (
                <div className="jb-log-filter-group">{t("logFilter.remoteBranches")}</div>
              )}
              {remoteBranches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={cn(
                    "jb-log-filter-item",
                    filters.branch === b.name && "jb-log-filter-item-active",
                  )}
                  onClick={() => {
                    setFilters((f) => ({ ...f, branch: b.name }));
                    close();
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </LogFilterDropdown>

        <LogFilterDropdown
          label={t("logFilter.user")}
          value={userLabel}
          active={!!filters.author}
          width={240}
        >
          {(close) => (
            <div className="jb-log-filter-list">
              <div className="jb-log-filter-search-wrap">
                <input
                  className="jb-log-filter-search"
                  placeholder={t("logFilter.filterUsers")}
                  value={userFilter}
                  autoFocus
                  onChange={(e) => setUserFilter(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={cn("jb-log-filter-item", !filters.author && "jb-log-filter-item-active")}
                onClick={() => {
                  setFilters((f) => ({ ...f, author: null }));
                  close();
                }}
              >
                {t("logFilter.allUsers")}
              </button>
              {shownAuthors.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={cn(
                    "jb-log-filter-item",
                    filters.author === a && "jb-log-filter-item-active",
                  )}
                  onClick={() => {
                    setFilters((f) => ({ ...f, author: a }));
                    close();
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </LogFilterDropdown>

        <LogFilterDropdown
          label={t("logFilter.date")}
          value={dateLabel}
          active={!!filters.since}
          width={200}
        >
          {(close) => (
            <div className="jb-log-filter-list">
              {dateOptions.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={cn(
                    "jb-log-filter-item",
                    filters.since === o.value && "jb-log-filter-item-active",
                  )}
                  onClick={() => {
                    setFilters((f) => ({ ...f, since: o.value }));
                    close();
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </LogFilterDropdown>

        <LogFilterDropdown
          label={t("logFilter.paths")}
          value={pathLabel}
          active={!!filters.path}
          width={260}
        >
          {(close) => (
            <div className="jb-log-filter-pathbox">
              <input
                className="jb-log-filter-search"
                placeholder={t("logFilter.pathPlaceholder")}
                value={pathDraft}
                autoFocus
                onChange={(e) => setPathDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setFilters((f) => ({ ...f, path: pathDraft.trim() }));
                    close();
                  }
                }}
              />
              <div className="jb-log-filter-pathbtns">
                <Button
                  size="sm"
                  onClick={() => {
                    setPathDraft("");
                    setFilters((f) => ({ ...f, path: "" }));
                    close();
                  }}
                >
                  {t("logFilter.clear")}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setFilters((f) => ({ ...f, path: pathDraft.trim() }));
                    close();
                  }}
                >
                  {t("logFilter.apply")}
                </Button>
              </div>
            </div>
          )}
        </LogFilterDropdown>
      </div>

      <div className="jb-log-main">
        <div ref={parentRef} className="jb-log-list">
          {filteredCommits.length === 0 && !loading ? (
            <EmptyState>{t("logFilter.noCommits")}</EmptyState>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualItems.map((item) => {
                const commit = filteredCommits[item.index];
                if (!commit) return null;
                return (
                  <div
                    key={commit.hash}
                    className={cn("jb-log-row", selectedHash === commit.hash && "jb-log-row-selected")}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${item.size}px`,
                      transform: `translateY(${item.start}px)`,
                    }}
                    onClick={() => void selectCommit(commit.hash)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ hash: commit.hash, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className="jb-log-graph">
                      <CommitGraph row={commit.graph_row} />
                    </div>
                    <div className="jb-log-subject-cell">
                      {commit.refs.map((r) => (
                        <RefBadge key={`${r.kind}:${r.name}`} refItem={r} />
                      ))}
                      <span className="jb-log-subject">{commit.subject}</span>
                    </div>
                    <div className="jb-log-author-cell">{commit.author}</div>
                    <div className="jb-log-date-cell">{formatLogDate(commit.date)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {loading && <Loading className="p-2" />}
        </div>

        {selectedCommit && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              className={cn("jb-panel-resize-handle", resizing && "jb-panel-resize-handle-active")}
              onMouseDown={startResize}
            />
            <aside className="jb-log-detail" style={{ width: detailWidth }}>
              <LogCommitDetail
                commit={selectedCommit}
                changedFiles={changedFiles}
                filesLoading={filesLoading}
                selectedPath={previewPath}
                onOpenFile={openFileDiff}
              />
            </aside>
          </>
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
