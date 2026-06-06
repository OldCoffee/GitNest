import { useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { highlightCode, highlightLine } from "./highlight";

export function HighlightedContent({
  code,
  path,
  className,
}: {
  code: string;
  path: string;
  className?: string;
}) {
  const { theme } = usePreferences();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(code, path, theme).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, path, theme]);

  if (html) {
    return (
      <div
        className={`shiki-preview overflow-auto ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre
      className={`overflow-auto whitespace-pre-wrap font-mono text-xs ${className ?? ""}`}
      style={{ color: "var(--jb-text)" }}
    >
      {code}
    </pre>
  );
}

export function HighlightedLine({
  content,
  path,
  fallbackClassName,
}: {
  content: string;
  path: string;
  fallbackClassName?: string;
}) {
  const { theme } = usePreferences();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightLine(content, path, theme).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [content, path, theme]);

  if (html) {
    return (
      <span
        className="shiki-line min-w-0 flex-1 break-all"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span className={`whitespace-pre-wrap break-all ${fallbackClassName ?? ""}`}>
      {content || " "}
    </span>
  );
}
