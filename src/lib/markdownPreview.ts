import { marked } from "marked";
import { convertFileSrc } from "@tauri-apps/api/core";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/** @internal exported for tests */
export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return "";
  if (idx === 0) return "/";
  return normalized.slice(0, idx);
}

/** @internal exported for tests */
export function joinPath(baseDir: string, relative: string): string {
  const base = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const absoluteUnix = base.startsWith("/");
  const parts = `${base}/${relative.replace(/\\/g, "/")}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  const joined = stack.join("/");
  if (absoluteUnix) return joined ? `/${joined}` : "/";
  return joined;
}

function isWindowsAbsPath(href: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(href);
}

function isAbsoluteLocalPath(href: string): boolean {
  return href.startsWith("/") || isWindowsAbsPath(href);
}

/** Scheme-based URLs (http, asset, mailto, …). Windows drive paths are not schemes. */
function isExternalUrl(href: string): boolean {
  if (isWindowsAbsPath(href)) return false;
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function resolveLocalUrl(href: string, filePath: string | null): string {
  if (!filePath || !href || href.startsWith("#") || isExternalUrl(href)) return href;
  const absolute = isAbsoluteLocalPath(href)
    ? href.replace(/\\/g, "/")
    : joinPath(dirname(filePath), href);
  try {
    return convertFileSrc(absolute);
  } catch {
    return href;
  }
}

/** Strip scripts / event handlers / javascript: URLs from marked HTML. */
export function sanitizeMarkdownHtml(html: string): string {
  return html
    .replace(/<\/?(?:script|iframe|object|embed|link|meta|form|base)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(?:href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript):[^"]*"|'\s*(?:javascript|vbscript):[^']*'|[^\s>]*(?:javascript|vbscript):[^\s>]*)/gi,
      "",
    );
}

function rewriteAttrUrls(html: string, attr: "src" | "href", absoluteFilePath: string): string {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])([^"']*)\\1`, "gi");
  return html.replace(re, (full, quote: string, value: string) => {
    if (attr === "href" && (value.startsWith("#") || isExternalUrl(value))) return full;
    // Local document links stay as-is; only media/pdf hrefs are asset-rewritten.
    if (attr === "href" && !/\.(png|jpe?g|gif|webp|svg|bmp|pdf)$/i.test(value)) return full;
    const next = resolveLocalUrl(value, absoluteFilePath);
    return `${attr}=${quote}${next}${quote}`;
  });
}

export function rewriteMarkdownUrls(html: string, absoluteFilePath: string | null): string {
  if (!absoluteFilePath) return html;
  return rewriteAttrUrls(rewriteAttrUrls(html, "src", absoluteFilePath), "href", absoluteFilePath);
}

export function renderMarkdown(source: string, absoluteFilePath: string | null = null): string {
  const raw = marked.parse(source, { async: false }) as string;
  return rewriteMarkdownUrls(sanitizeMarkdownHtml(raw), absoluteFilePath);
}

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}
