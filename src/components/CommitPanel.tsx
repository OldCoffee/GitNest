import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CommitOptions } from "../lib/types";
import { useT } from "../context/PreferencesContext";
import { Button, Checkbox, InlineAlert, Input, TextArea } from "./ui";
import { cn } from "../lib/utils";
import { invalidateAfterGitMutation } from "../lib/queryInvalidation";
import { useAppStore } from "../store/appStore";

const SUBJECT_SOFT_LIMIT = 50;

function splitCommitTemplate(template: string): { subject: string; body: string } {
  const normalized = template.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const subject = (lines[0] ?? "").trim();
  const body = lines.slice(1).join("\n").trim();
  return { subject, body };
}

function summarizeCommitError(message: string): string {
  const lines = message
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return message;
  return lines.slice(-3).join("\n");
}

export const CommitPanel = memo(function CommitPanel({
  onCommitted,
}: {
  onCommitted: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [amend, setAmend] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefilledRef = useRef<{ subject: string; body: string } | null>(null);
  const userEditedRef = useRef(false);
  const subjectRef = useRef(subject);
  const bodyRef = useRef(body);
  subjectRef.current = subject;
  bodyRef.current = body;

  const loadTemplateIfEmpty = useCallback(async () => {
    if (userEditedRef.current) return;
    if (subjectRef.current.trim() || bodyRef.current.trim()) return;
    try {
      const template = await api.getCommitTemplate();
      if (userEditedRef.current) return;
      if (subjectRef.current.trim() || bodyRef.current.trim()) return;
      if (!template) return;
      const fill = splitCommitTemplate(template);
      if (!fill.subject && !fill.body) return;
      prefilledRef.current = fill;
      setSubject(fill.subject);
      setBody(fill.body);
    } catch {
      setError(t("commitPanel.templateLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    function onFocusCommit() {
      document.getElementById("commit-subject-input")?.focus();
    }
    window.addEventListener("rebased:focus-commit", onFocusCommit);
    return () => window.removeEventListener("rebased:focus-commit", onFocusCommit);
  }, []);

  useEffect(() => {
    void loadTemplateIfEmpty();
  }, [loadTemplateIfEmpty]);

  function markEdited() {
    userEditedRef.current = true;
  }

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
      const result = await api.commitChanges(options);
      if (result.output.trim()) {
        appendVcsOutput(
          t("commitPanel.vcsOutputPrefix", { hash: result.hash }) + "\n" + result.output.trimEnd(),
        );
      }
      setSubject("");
      setBody("");
      setAmend(false);
      prefilledRef.current = null;
      userEditedRef.current = false;
      onCommitted();
      await invalidateAfterGitMutation(queryClient);
      await loadTemplateIfEmpty();
    } catch (e) {
      const message = String(e);
      appendVcsOutput(t("commitPanel.vcsOutputFailed") + "\n" + message);
      setError(summarizeCommitError(message));
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
        onChange={(e) => {
          markEdited();
          setSubject(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCommit();
        }}
      />
      <TextArea
        className="jb-commit-body"
        placeholder={t("commitPanel.description")}
        rows={3}
        value={body}
        onChange={(e) => {
          markEdited();
          setBody(e.target.value);
        }}
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
