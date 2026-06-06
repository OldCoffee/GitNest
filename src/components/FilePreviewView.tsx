import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { DiffHunk, DiffLine, DiffTab, FilePreview } from "../lib/types";
import { formatFileSize } from "../lib/fileType";
import { HighlightedContent, HighlightedLine } from "../lib/highlightView";
import { langFromPath } from "../lib/highlight";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";

interface FilePreviewViewProps {
  preview: FilePreview;
  diffMode: "unified" | "split";
  tab?: DiffTab;
}

export function FilePreviewView({ preview, diffMode, tab }: FilePreviewViewProps) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);

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

  const header = (
    <div className="jb-preview-header">
      {preview.path}
      {tab && <span className="ml-2 uppercase">{tab.mode}</span>}
      <span className="ml-2">{kindLabel(preview.kind)}</span>
      {preview.kind === "text_diff" && <span className="ml-2">({diffMode})</span>}
      {preview.language && <span className="ml-2 jb-text-accent">{preview.language}</span>}
      {preview.size_bytes > 0 && <span className="ml-2">{formatFileSize(preview.size_bytes)}</span>}
    </div>
  );

  let body: ReactNode;

  switch (preview.kind) {
    case "text_diff":
      body =
        preview.diff && preview.diff.hunks.length > 0 ? (
          diffMode === "split" ? (
            preview.diff.hunks.map((hunk, i) => (
              <SplitHunk
                key={i}
                hunk={hunk}
                path={preview.path}
                onLineDoubleClick={onLineDoubleClick}
              />
            ))
          ) : (
            preview.diff.hunks.map((hunk, i) => (
              <UnifiedHunk
                key={i}
                hunk={hunk}
                path={preview.path}
                onLineDoubleClick={onLineDoubleClick}
              />
            ))
          )
        ) : (
          <div className="jb-empty-state">{t("preview.noChanges")}</div>
        );
      break;
    case "text_content":
      body = preview.content ? (
        <HighlightedContent code={preview.content} path={preview.path} className="p-4" />
      ) : (
        <div className="jb-empty-state">{t("preview.emptyFile")}</div>
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
      <p className="mb-1 text-xs jb-text-error">{t("preview.deletedFile")}</p>
      <p className="mb-3 break-all text-xs jb-text-dim">
        {t("preview.deletedMissingPath", { path: preview.path })}
      </p>
      <p className="mb-3 text-xs jb-text-dim">{t("preview.staleHint")}</p>
      {tab && (
        <button
          type="button"
          className="jb-action-btn mb-4"
          onClick={() => closeEditorTab(tab.id)}
        >
          {t("preview.closeTab")}
        </button>
      )}
      {hasDiff && (
        <div className="font-mono text-xs">
          {preview.diff!.hunks.map((hunk, i) => (
            <UnifiedHunk
              key={i}
              hunk={hunk}
              path={preview.path}
              onLineDoubleClick={onLineDoubleClick}
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
      <button type="button" className="jb-action-btn" onClick={() => void onOpen()}>
        {t("preview.openInSystem")}
      </button>
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

function UnifiedHunk({
  hunk,
  path,
  onLineDoubleClick,
}: {
  hunk: DiffHunk;
  path: string;
  onLineDoubleClick: (line: DiffLine) => void;
}) {
  const t = useT();
  const useHighlight = langFromPath(path) !== null;

  return (
    <div>
      <div className="jb-diff-gutter px-3 py-1">
        @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
      </div>
      {hunk.lines.map((line, i) => (
        <div
          key={i}
          className="flex cursor-default px-3 py-0.5"
          style={lineStyle(line.kind)}
          onDoubleClick={() => onLineDoubleClick(line)}
          title={t("preview.copyLineHint")}
        >
          <span className="mr-2 w-4 shrink-0 select-none opacity-60">
            {linePrefix(line.kind)}
          </span>
          {useHighlight ? (
            <HighlightedLine content={line.content} path={path} />
          ) : (
            <span className="whitespace-pre-wrap break-all">{line.content || " "}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SplitHunk({
  hunk,
  path,
  onLineDoubleClick,
}: {
  hunk: DiffHunk;
  path: string;
  onLineDoubleClick: (line: DiffLine) => void;
}) {
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  let leftBuf: DiffLine[] = [];
  let rightBuf: DiffLine[] = [];

  for (const line of hunk.lines) {
    if (line.kind === "remove") leftBuf.push(line);
    else if (line.kind === "add") rightBuf.push(line);
    else {
      while (leftBuf.length || rightBuf.length) {
        pairs.push({
          left: leftBuf.shift() ?? null,
          right: rightBuf.shift() ?? null,
        });
      }
      pairs.push({ left: line, right: line });
    }
  }
  while (leftBuf.length || rightBuf.length) {
    pairs.push({
      left: leftBuf.shift() ?? null,
      right: rightBuf.shift() ?? null,
    });
  }

  return (
    <div>
      <div className="jb-diff-gutter px-3 py-1">
        @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
      </div>
      {pairs.map((pair, i) => (
        <div key={i} className="grid grid-cols-2">
          <SplitCell
            line={pair.left}
            path={path}
            onLineDoubleClick={onLineDoubleClick}
          />
          <SplitCell
            line={pair.right}
            path={path}
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
  onLineDoubleClick,
  borderLeft,
}: {
  line: DiffLine | null;
  path: string;
  onLineDoubleClick: (line: DiffLine) => void;
  borderLeft?: boolean;
}) {
  const t = useT();
  const useHighlight = langFromPath(path) !== null;

  if (!line) {
    return (
      <div
        className="min-h-[1.25rem] px-2 py-0.5"
        style={{
          background: "var(--jb-bg)",
          borderLeft: borderLeft ? `1px solid var(--jb-border)` : undefined,
        }}
      />
    );
  }
  return (
    <div
      className="flex min-h-[1.25rem] cursor-default px-2 py-0.5"
      style={{
        ...lineStyle(line.kind),
        borderLeft: borderLeft ? `1px solid var(--jb-border)` : undefined,
      }}
      onDoubleClick={() => onLineDoubleClick(line)}
      title={t("preview.copyLineHint")}
    >
      <span className="mr-1 w-3 shrink-0 select-none opacity-60">
        {linePrefix(line.kind)}
      </span>
      {useHighlight ? (
        <HighlightedLine content={line.content} path={path} />
      ) : (
        <span className="whitespace-pre-wrap break-all">{line.content || " "}</span>
      )}
    </div>
  );
}
