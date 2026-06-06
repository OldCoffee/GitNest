import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { formatFileSize } from "../lib/fileType";
import { langFromPath } from "../lib/highlight";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { EmptyState, Loading } from "./ui";

export function FileEditor({ path }: { path: string }) {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["file-text", path],
    queryFn: () => api.readTextFile(path),
    staleTime: 0,
  });

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data && !data.is_binary && !data.too_large) {
      setContent(data.content);
      setSavedContent(data.content);
      setSaveError(null);
    }
  }, [data]);

  const editable = !!data && !data.is_binary && !data.too_large;
  const dirty = editable && content !== savedContent;

  const save = useCallback(async () => {
    if (!editable || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.writeTextFile(path, content);
      setSavedContent(content);
      await queryClient.invalidateQueries({ queryKey: ["status"] });
      await queryClient.invalidateQueries({ queryKey: ["preview"] });
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }, [editable, saving, path, content, queryClient]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${content.slice(0, start)}  ${content.slice(end)}`;
      setContent(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  async function openInSystem() {
    const abs = repo ? `${repo.path.replace(/[/\\]+$/, "")}/${path}` : path;
    try {
      await openPath(abs);
    } catch {
      // ignore
    }
  }

  if (isLoading) {
    return <Loading className="p-4">{t("common.loading")}</Loading>;
  }
  if (error) {
    return <EmptyState className="jb-text-error p-4">{String(error)}</EmptyState>;
  }
  if (!data) return null;

  const language = langFromPath(path);

  return (
    <div className="flex h-full flex-col">
      <div className="jb-preview-header flex items-center gap-2">
        <span className="min-w-0 truncate">{path}</span>
        {language && <span className="jb-text-accent">{language}</span>}
        {data.size_bytes > 0 && <span>{formatFileSize(data.size_bytes)}</span>}
        {dirty && <span className="jb-file-editor-dirty">●</span>}
        <span className="flex-1" />
        {editable && (
          <button
            type="button"
            className="jb-action-btn py-0.5"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? t("fileEditor.saving") : dirty ? t("fileEditor.save") : t("fileEditor.saved")}
          </button>
        )}
      </div>

      {saveError && (
        <div className="px-3 py-1 text-xs jb-text-error">{saveError}</div>
      )}

      {editable ? (
        <textarea
          ref={textareaRef}
          className="jb-file-editor-area min-h-0 flex-1"
          value={content}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onTextareaKeyDown}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
          <p className="text-xs jb-text-dim">
            {data.too_large ? t("fileEditor.tooLarge") : t("fileEditor.binaryNotEditable")}
          </p>
          {data.size_bytes > 0 && (
            <p className="text-xs jb-text-dim">{formatFileSize(data.size_bytes)}</p>
          )}
          <button type="button" className="jb-action-btn" onClick={() => void openInSystem()}>
            {t("fileEditor.openInSystem")}
          </button>
        </div>
      )}
    </div>
  );
}
