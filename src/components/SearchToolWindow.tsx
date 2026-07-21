import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { SearchBatch, SearchMatch } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import {
  Button,
  Checkbox,
  EmptyState,
  InlineAlert,
  ListRow,
  SearchInput,
  ToolbarStrip,
  ToolWindowShell,
} from "./ui";
import { cn } from "../lib/utils";

function highlightPreview(preview: string, query: string, caseSensitive: boolean) {
  const q = query.trim();
  if (!q || !preview) return preview;
  const source = caseSensitive ? preview : preview.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const idx = source.indexOf(needle);
  if (idx < 0) return preview;
  return (
    <>
      {preview.slice(0, idx)}
      <mark className="jb-search-mark">{preview.slice(idx, idx + q.length)}</mark>
      {preview.slice(idx + q.length)}
    </>
  );
}

export function SearchToolWindow() {
  const t = useT();
  const openFileEditor = useAppStore((state) => state.openFileEditor);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNamesOnly, setFileNamesOnly] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeTask = useRef<number | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<SearchBatch>("search-results", ({ payload }) => {
      if (payload.taskId !== activeTask.current) return;
      if (payload.matches.length) {
        setMatches((current) => [...current, ...payload.matches]);
      }
      if (payload.done) {
        setRunning(false);
        setError(payload.error);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, []);

  const fileCount = useMemo(() => new Set(matches.map((m) => m.path)).size, [matches]);

  async function search() {
    const value = query.trim();
    if (!value) return;
    if (activeTask.current != null) {
      await api.cancelTask(activeTask.current);
    }
    setMatches([]);
    setError(null);
    setActiveIndex(-1);
    setRunning(true);
    try {
      activeTask.current = await api.startWorkspaceSearch(value, {
        fileNamesOnly,
        caseSensitive,
      });
    } catch (searchError) {
      setRunning(false);
      setError(String(searchError));
    }
  }

  async function cancel() {
    if (activeTask.current == null) return;
    await api.cancelTask(activeTask.current);
    setRunning(false);
  }

  function openMatch(match: SearchMatch, index: number) {
    setActiveIndex(index);
    openFileEditor(match.path);
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("gitnest:goto-location", {
          detail: { path: match.path, line: match.line, column: match.column },
        }),
      );
    }, 0);
  }

  return (
    <ToolWindowShell title={t("sidebar.search")} bodyClassName="p-0">
      <ToolbarStrip className="jb-search-toolbar flex-col items-stretch">
        <div className="jb-search-toolbar-row">
          <SearchInput
            value={query}
            placeholder={t("search.placeholder")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
            wrapClassName="min-w-0 flex-1"
          />
          {running ? (
            <Button onClick={() => void cancel()}>{t("search.cancel")}</Button>
          ) : (
            <Button variant="primary" onClick={() => void search()} disabled={!query.trim()}>
              {t("search.search")}
            </Button>
          )}
        </div>
        <div className="jb-search-toolbar-options">
          <Checkbox
            label={t("search.filesOnly")}
            checked={fileNamesOnly}
            onChange={(event) => setFileNamesOnly(event.target.checked)}
          />
          <Checkbox
            label={t("search.matchCase")}
            checked={caseSensitive}
            onChange={(event) => setCaseSensitive(event.target.checked)}
          />
          {(running || matches.length > 0) && (
            <span className="jb-search-status">
              {running
                ? t("search.searching")
                : t("search.results", { count: matches.length, files: fileCount })}
            </span>
          )}
        </div>
      </ToolbarStrip>
      {error && (
        <InlineAlert level="error" className="m-2">
          {error}
        </InlineAlert>
      )}
      <div className="jb-search-results min-h-0 flex-1 overflow-auto">
        {!running && matches.length === 0 && <EmptyState>{t("search.empty")}</EmptyState>}
        {matches.map((match, index) => (
          <ListRow
            key={`${match.path}:${match.line}:${match.column}:${index}`}
            selected={index === activeIndex}
            className={cn("jb-search-result", index === activeIndex && "jb-search-result-active")}
            onClick={() => openMatch(match, index)}
          >
            <span className="jb-search-result-path" title={match.path}>
              {match.path}
            </span>
            {match.line > 0 && (
              <span className="jb-search-result-line">
                {match.line}:{match.column + 1}
              </span>
            )}
            {match.preview && (
              <span className="jb-search-result-preview">
                {highlightPreview(match.preview, query, caseSensitive)}
              </span>
            )}
          </ListRow>
        ))}
      </div>
    </ToolWindowShell>
  );
}
