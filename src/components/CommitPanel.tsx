import { memo, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CommitOptions } from "../lib/types";
import { useT } from "../context/PreferencesContext";

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

  useEffect(() => {
    function onFocusCommit() {
      document.getElementById("commit-subject-input")?.focus();
    }
    window.addEventListener("rebased:focus-commit", onFocusCommit);
    return () => window.removeEventListener("rebased:focus-commit", onFocusCommit);
  }, []);

  async function handleCommit() {
    const options: CommitOptions = {
      subject: subject.trim(),
      body: body.trim(),
      amend,
      signoff,
    };
    if (!options.subject && !options.amend) return;

    setCommitting(true);
    try {
      await api.commitChanges(options);
      setSubject("");
      setBody("");
      setAmend(false);
      onCommitted();
      await queryClient.invalidateQueries({ queryKey: ["log"] });
      await queryClient.invalidateQueries({ queryKey: ["status"] });
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="p-3">
      <input
        id="commit-subject-input"
        className="jb-input mb-2 text-sm"
        placeholder={t("commitPanel.subject")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCommit();
        }}
      />
      <textarea
        className="jb-input mb-2 resize-none text-xs"
        placeholder={t("commitPanel.description")}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mb-2 flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={amend}
            onChange={(e) => setAmend(e.target.checked)}
          />
          {t("commitPanel.amend")}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={signoff}
            onChange={(e) => setSignoff(e.target.checked)}
          />
          {t("commitPanel.signoff")}
        </label>
      </div>
      <button
        type="button"
        disabled={committing || (!subject.trim() && !amend)}
        onClick={() => void handleCommit()}
        className="jb-btn-primary w-full"
      >
        {committing ? t("commitPanel.committing") : t("commitPanel.commit")}
      </button>
    </div>
  );
});
