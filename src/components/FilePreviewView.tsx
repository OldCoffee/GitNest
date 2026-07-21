import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { DiffHunk, DiffLine, DiffTab, FilePreview } from "../lib/types";
import { api } from "../lib/api";
import { formatFileSize } from "../lib/fileType";
import { HighlightedContent, HighlightedLine } from "../lib/highlightView";
import { langFromPath } from "../lib/highlight";
import { invalidatePreview, invalidateStatus } from "../lib/queryInvalidation";
import { computeWordDiff, type WordSegment } from "../lib/wordDiff";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { Button, EmptyState, InlineAlert, Tabs } from "./ui";

type DiffMode = "unified" | "split";

interface FilePreviewViewProps {
  preview: FilePreview;
  diffMode: DiffMode;
  tab?: DiffTab;
}

export function FilePreviewView({ preview, diffMode, tab }: FilePreviewViewProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const repo = useAppStore((s) => s.repo);
  const [mode, setMode] = useState<DiffMode>(diffMode);
  const [hunkBusy, setHunkBusy] = useState(false);
  const [hunkError, setHunkError] = useState<string | null>(null);

  // Re-sync when the global setting changes (only as a new default).
  useEffect(() => setMode(diffMode), [diffMode]);

  const onHunkAction = useCallback(
    async (hunk: DiffHunk, action: "stage" | "unstage") => {
      setHunkBusy(true);
      setHunkError(null);
      try {
        if (action === "stage") {
          await api.stageHunk(preview.path, hunk);
        } else {
          await api.unstageHunk(preview.path, hunk);
        }
        await Promise.all([
          invalidateStatus(queryClient),
          invalidatePreview(queryClient),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setHunkError(t("commit.hunkActionFailed", { error: message }));
      } finally {
        setHunkBusy(false);
      }
    },
    [preview.path, queryClient, t],
  );

  const hunkAction =
    tab?.mode === "working" ? ("stage" as const) : tab?.mode === "staged" ? ("unstage" as const) : null;

  const kindLabel = (kind: string) => {
    switch (kind) {
      case "text_diff":
        return t("preview.diff");
      case "text_content":
        return t("preview.file");
      case "image":
        return t("preview.image");
      case "binary":
        return t("preview.binary");
      case "deleted":
        return t("preview.deleted");
      default:
        return kind;
    }
  };

  const onLineDoubleClick = useCallback((line: DiffLine) => {
    void navigator.clipboard?.writeText(line.content);
  }, []);

  async function openInSystem() {
    const target =
      preview.absolute_path ??
      (repo ? `${repo.path}/${preview.path}` : preview.path);
    try {
      await openPath(target);
    } catch {
      try {
        await revealItemInDir(target);
      } catch {
        // ignore: opener not available
      }
    }
  }

  const isDiff = preview.kind === "text_diff" || preview.kind === "deleted";

  const header = (
    <div className="jb-preview-header">
      <span className="jb-preview-path" title={preview.path}>
        {preview.path}
      </span>
      {tab && <span className="jb-preview-meta">{tab.mode}</span>}
      <span className="jb-preview-meta">{kindLabel(preview.kind)}</span>
      {preview.language && (
        <span className="jb-preview-meta jb-preview-meta-accent">{preview.language}</span>
      )}
      {preview.size_bytes > 0 && (
        <span className="jb-preview-meta">{formatFileSize(preview.size_bytes)}</span>
      )}
      {isDiff && (
        <Tabs
          variant="segmented"
          aria-label={t("settings.diffMode")}
          value={mode}
          onChange={setMode}
          tabs={[
            { id: "unified", label: t("preview.unified") },
            { id: "split", label: t("preview.split") },
          ]}
        />
      )}
    </div>
  );

  let body: ReactNode;

  switch (preview.kind) {
    case "text_diff":
      body =
        preview.diff && preview.diff.hunks.length > 0 ? (
          <div className="flex flex-col">
            {hunkError && (
              <div className="px-3 py-2">
                <InlineAlert level="error">{hunkError}</InlineAlert>
              </div>
            )}
            {preview.diff.hunks.map((hunk, i) =>
              mode === "split" ? (
                <SplitHunk
                  key={i}
                  hunk={hunk}
                  path={preview.path}
                  onLineDoubleClick={onLineDoubleClick}
                  hunkAction={hunkAction}
                  hunkBusy={hunkBusy}
                  onHunkAction={onHunkAction}
                />
              ) : (
                <UnifiedHunk
                  key={i}
                  hunk={hunk}
                  path={preview.path}
                  onLineDoubleClick={onLineDoubleClick}
                  hunkAction={hunkAction}
                  hunkBusy={hunkBusy}
                  onHunkAction={onHunkAction}
                />
              ),
            )}
          </div>
        ) : (
          <EmptyState>{t("preview.noChanges")}</EmptyState>
        );
      break;
    case "text_content":
      body = preview.content ? (
        <HighlightedContent code={preview.content} path={preview.path} className="p-4" />
      ) : (
        <EmptyState>{t("preview.emptyFile")}</EmptyState>
      );
      break;
    case "image":
      body = preview.data_base64 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto p-4">
          <img
            src={`data:${preview.mime};base64,${preview.data_base64}`}
            alt={preview.path}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <BinaryFallback preview={preview} onOpen={openInSystem} t={t} />
      );
      break;
    case "binary":
      body = <BinaryFallback preview={preview} onOpen={openInSystem} t={t} />;
      break;
    case "deleted":
      body = <DeletedView preview={preview} tab={tab} onLineDoubleClick={onLineDoubleClick} t={t} />;
      break;
    default:
      body = null;
  }

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-auto font-mono text-xs">{body}</div>
    </div>
  );
}

function DeletedView({
  preview,
  tab,
  onLineDoubleClick,
  t,
}: {
  preview: FilePreview;
  tab?: DiffTab;
  onLineDoubleClick: (line: DiffLine) => void;
  t: ReturnType<typeof useT>;
}) {
  const closeEditorTab = useAppStore((s) => s.closeEditorTab);
  const hasDiff = !!preview.diff && preview.diff.hunks.length > 0;

  return (
    <div className="p-4">
      <InlineAlert level="error" className="mb-3">
        {t("preview.deletedFile")}
      </InlineAlert>
      <p className="mb-3 break-all text-xs jb-text-dim">
        {t("preview.deletedMissingPath", { path: preview.path })}
      </p>
      <p className="mb-3 text-xs jb-text-dim">{t("preview.staleHint")}</p>
      {tab && (
        <Button className="mb-4" onClick={() => closeEditorTab(tab.id)}>
          {t("preview.closeTab")}
        </Button>
      )}
      {hasDiff && (
        <div className="font-mono text-xs">
          {preview.diff!.hunks.map((hunk, i) => (
            <UnifiedHunk
              key={i}
              hunk={hunk}
              path={preview.path}
              onLineDoubleClick={onLineDoubleClick}
              hunkAction={null}
              hunkBusy={false}
              onHunkAction={() => undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BinaryFallback({
  preview,
  onOpen,
  t,
}: {
  preview: FilePreview;
  onOpen: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <p className="text-xs jb-text-dim">{t("preview.binaryFile", { mime: preview.mime })}</p>
      {preview.size_bytes > 0 && (
        <p className="text-xs jb-text-dim">{formatFileSize(preview.size_bytes)}</p>
      )}
      <Button onClick={() => void onOpen()}>{t("preview.openInSystem")}</Button>
    </div>
  );
}

function lineStyle(kind: DiffLine["kind"]): CSSProperties {
  if (kind === "add") return { background: "var(--jb-diff-add-bg)", color: "var(--jb-success)" };
  if (kind === "remove") return { background: "var(--jb-diff-del-bg)", color: "var(--jb-error)" };
  return { color: "var(--jb-text)" };
}

function linePrefix(kind: DiffLine["kind"]) {
  return kind === "add" ? "+" : kind === "remove" ? "-" : " ";
}

function lineNo(n: number | null | undefined) {
  return n == null ? "" : String(n);
}

function WordContent({
  segments,
  side,
}: {
  segments: WordSegment[];
  side: "add" | "remove";
}) {
  const cls = side === "add" ? "jb-diff-word-add" : "jb-diff-word-del";
  return (
    <span className="whitespace-pre-wrap break-all">
      {segments.map((seg, i) =>
        seg.changed ? (
          <span key={i} className={cls}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

function LineText({
  line,
  path,
  segments,
}: {
  line: DiffLine;
  path: string;
  segments?: WordSegment[];
}) {
  if (segments) {
    return <WordContent segments={segments} side={line.kind === "remove" ? "remove" : "add"} />;
  }
  if (langFromPath(path) !== null) {
    return <HighlightedLine content={line.content} path={path} />;
  }
  return <span className="whitespace-pre-wrap break-all">{line.content || " "}</span>;
}

/**
 * Pairs each run of removed lines with the immediately following run of added
 * lines so the changed parts can be word-highlighted index by index.
 */
function buildWordSegments(lines: DiffLine[]): Array<WordSegment[] | undefined> {
  const result: Array<WordSegment[] | undefined> = new Array(lines.length).fill(undefined);
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind === "remove") {
      const removeStart = i;
      while (i < lines.length && lines[i].kind === "remove") i++;
      const addStart = i;
      while (i < lines.length && lines[i].kind === "add") i++;
      const removes = addStart - removeStart;
      const adds = i - addStart;
      const pairs = Math.min(removes, adds);
      for (let k = 0; k < pairs; k++) {
        const oldLine = lines[removeStart + k];
        const newLine = lines[addStart + k];
        const wd = computeWordDiff(oldLine.content, newLine.content);
        result[removeStart + k] = wd.old;
        result[addStart + k] = wd.new;
      }
    } else {
      i++;
    }
  }
  return result;
}

function HunkHeader({
  hunk,
  hunkAction,
  hunkBusy,
  onHunkAction,
}: {
  hunk: DiffHunk;
  hunkAction: "stage" | "unstage" | null;
  hunkBusy: boolean;
  onHunkAction: (hunk: DiffHunk, action: "stage" | "unstage") => void;
}) {
  const t = useT();
  return (
    <div className="jb-diff-gutter flex items-center justify-between gap-2 px-3 py-1">
      <span>
        @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
      </span>
      {hunkAction && (
        <Button
          size="sm"
          variant="ghost"
          disabled={hunkBusy}
          onClick={() => onHunkAction(hunk, hunkAction)}
        >
          {hunkAction === "stage" ? t("commit.stageHunk") : t("commit.unstageHunk")}
        </Button>
      )}
    </div>
  );
}

function UnifiedHunk({
  hunk,
  path,
  onLineDoubleClick,
  hunkAction,
  hunkBusy,
  onHunkAction,
}: {
  hunk: DiffHunk;
  path: string;
  onLineDoubleClick: (line: DiffLine) => void;
  hunkAction: "stage" | "unstage" | null;
  hunkBusy: boolean;
  onHunkAction: (hunk: DiffHunk, action: "stage" | "unstage") => void;
}) {
  const t = useT();
  const segments = buildWordSegments(hunk.lines);

  return (
    <div>
      <HunkHeader
        hunk={hunk}
        hunkAction={hunkAction}
        hunkBusy={hunkBusy}
        onHunkAction={onHunkAction}
      />
      {hunk.lines.map((line, i) => (
        <div
          key={i}
          className="jb-diff-line flex cursor-default"
          style={lineStyle(line.kind)}
          onDoubleClick={() => onLineDoubleClick(line)}
          title={t("preview.copyLineHint")}
        >
          <span className="jb-diff-lineno">{lineNo(line.old_lineno)}</span>
          <span className="jb-diff-lineno">{lineNo(line.new_lineno)}</span>
          <span className="jb-diff-sign select-none opacity-60">{linePrefix(line.kind)}</span>
          <LineText line={line} path={path} segments={segments[i]} />
        </div>
      ))}
    </div>
  );
}

function SplitHunk({
  hunk,
  path,
  onLineDoubleClick,
  hunkAction,
  hunkBusy,
  onHunkAction,
}: {
  hunk: DiffHunk;
  path: string;
  onLineDoubleClick: (line: DiffLine) => void;
  hunkAction: "stage" | "unstage" | null;
  hunkBusy: boolean;
  onHunkAction: (hunk: DiffHunk, action: "stage" | "unstage") => void;
}) {
  const segments = buildWordSegments(hunk.lines);
  const pairs: Array<{
    left: DiffLine | null;
    right: DiffLine | null;
    leftSeg?: WordSegment[];
    rightSeg?: WordSegment[];
  }> = [];

  const leftBuf: Array<{ line: DiffLine; seg?: WordSegment[] }> = [];
  const rightBuf: Array<{ line: DiffLine; seg?: WordSegment[] }> = [];

  const flush = () => {
    while (leftBuf.length || rightBuf.length) {
      const l = leftBuf.shift();
      const r = rightBuf.shift();
      pairs.push({
        left: l?.line ?? null,
        right: r?.line ?? null,
        leftSeg: l?.seg,
        rightSeg: r?.seg,
      });
    }
  };

  hunk.lines.forEach((line, i) => {
    if (line.kind === "remove") leftBuf.push({ line, seg: segments[i] });
    else if (line.kind === "add") rightBuf.push({ line, seg: segments[i] });
    else {
      flush();
      pairs.push({ left: line, right: line });
    }
  });
  flush();

  return (
    <div>
      <HunkHeader
        hunk={hunk}
        hunkAction={hunkAction}
        hunkBusy={hunkBusy}
        onHunkAction={onHunkAction}
      />
      {pairs.map((pair, i) => (
        <div key={i} className="grid grid-cols-2">
          <SplitCell line={pair.left} path={path} segments={pair.leftSeg} onLineDoubleClick={onLineDoubleClick} />
          <SplitCell
            line={pair.right}
            path={path}
            segments={pair.rightSeg}
            onLineDoubleClick={onLineDoubleClick}
            borderLeft
          />
        </div>
      ))}
    </div>
  );
}

function SplitCell({
  line,
  path,
  segments,
  onLineDoubleClick,
  borderLeft,
}: {
  line: DiffLine | null;
  path: string;
  segments?: WordSegment[];
  onLineDoubleClick: (line: DiffLine) => void;
  borderLeft?: boolean;
}) {
  const t = useT();

  if (!line) {
    return (
      <div
        className="jb-diff-line"
        style={{
          background: "var(--jb-bg)",
          borderLeft: borderLeft ? `1px solid var(--jb-border)` : undefined,
        }}
      />
    );
  }
  const number = line.kind === "remove" ? line.old_lineno : line.new_lineno;
  return (
    <div
      className="jb-diff-line flex cursor-default"
      style={{
        ...lineStyle(line.kind),
        borderLeft: borderLeft ? `1px solid var(--jb-border)` : undefined,
      }}
      onDoubleClick={() => onLineDoubleClick(line)}
      title={t("preview.copyLineHint")}
    >
      <span className="jb-diff-lineno">{lineNo(number)}</span>
      <span className="jb-diff-sign select-none opacity-60">{linePrefix(line.kind)}</span>
      <LineText line={line} path={path} segments={segments} />
    </div>
  );
}
