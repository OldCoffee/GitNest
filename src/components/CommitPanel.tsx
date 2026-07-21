import { memo, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CommitOptions } from "../lib/types";
import { useT } from "../context/PreferencesContext";
import { Button, Checkbox, InlineAlert, Input, TextArea } from "./ui";
import { cn } from "../lib/utils";
import { invalidateAfterGitMutation } from "../lib/queryInvalidation";

const SUBJECT_SOFT_LIMIT = 50;

export const CommitPanel = memo(function CommitPanel({
  onCommitted,
}: {
  onCommitted: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [amend, setAmend] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefilledRef = useRef<{ subject: string; body: string } | null>(null);

  useEffect(() => {
    function onFocusCommit() {
      document.getElementById("commit-subject-input")?.focus();
    }
    window.addEventListener("rebased:focus-commit", onFocusCommit);
    return () => window.removeEventListener("rebased:focus-commit", onFocusCommit);
  }, []);

  async function onToggleAmend(next: boolean) {
    setAmend(next);
    if (next) {
      if (!subject.trim() && !body.trim()) {
        try {
          const [last] = await api.getLog(null, 0, 1);
          if (last) {
            const fill = { subject: last.subject ?? "", body: last.body?.trim() ?? "" };
            prefilledRef.current = fill;
            setSubject(fill.subject);
            setBody(fill.body);
          }
        } catch {
          // ignore: amend prefill is best-effort
        }
      }
    } else if (prefilledRef.current) {
      if (subject === prefilledRef.current.subject && body === prefilledRef.current.body) {
        setSubject("");
        setBody("");
      }
      prefilledRef.current = null;
    }
  }

  async function handleCommit() {
    const options: CommitOptions = {
      subject: subject.trim(),
      body: body.trim(),
      amend,
      signoff,
    };
    if (!options.subject && !options.amend) return;

    setCommitting(true);
    setError(null);
    try {
      await api.commitChanges(options);
      setSubject("");
      setBody("");
      setAmend(false);
      prefilledRef.current = null;
      onCommitted();
      await invalidateAfterGitMutation(queryClient);
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  }

  const subjectLen = subject.trim().length;
  const subjectOver = subjectLen > SUBJECT_SOFT_LIMIT;

  return (
    <div className="jb-commit-panel">
      <Input
        id="commit-subject-input"
        data-testid="commit-subject"
        className="jb-commit-subject"
        placeholder={t("commitPanel.subject")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCommit();
        }}
      />
      <TextArea
        className="jb-commit-body"
        placeholder={t("commitPanel.description")}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="jb-commit-options">
        <Checkbox
          label={t("commitPanel.amend")}
          checked={amend}
          onChange={(e) => void onToggleAmend(e.target.checked)}
        />
        <Checkbox
          label={t("commitPanel.signoff")}
          checked={signoff}
          onChange={(e) => setSignoff(e.target.checked)}
        />
      </div>
      {error && (
        <InlineAlert level="error" className="mb-2">
          {error}
        </InlineAlert>
      )}
      <div className="jb-commit-actions">
        <span className={cn("jb-commit-counter", subjectOver && "jb-commit-counter-warn")}>
          {subjectLen}
          {subjectOver ? ` / ${SUBJECT_SOFT_LIMIT}` : ""}
        </span>
        <Button
          variant="primary"
          className="jb-commit-btn"
          data-testid="commit-button"
          loading={committing}
          disabled={!subject.trim() && !amend}
          onClick={() => void handleCommit()}
        >
          {committing ? t("commitPanel.committing") : t("commitPanel.commit")}
        </Button>
      </div>
    </div>
  );
});
