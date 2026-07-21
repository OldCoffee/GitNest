import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo, type MouseEvent } from "react";
import { renderMarkdown } from "../lib/markdownPreview";

export function MarkdownPreview({
  source,
  absoluteFilePath,
}: {
  source: string;
  absoluteFilePath: string | null;
}) {
  const html = useMemo(
    () => renderMarkdown(source, absoluteFilePath),
    [source, absoluteFilePath],
  );

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    event.preventDefault();
    if (/^(?:https?:|mailto:)/i.test(href)) {
      void openUrl(href);
    }
  }

  return (
    <div
      className="jb-md-preview jb-scroll min-h-0 flex-1 overflow-auto"
      onClick={onClick}
      // Sanitized HTML from marked + DOM scrubber.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
