import { marked } from "marked";
import { convertFileSrc } from "@tauri-apps/api/core";

marked.setOptions({
  gfm: true,
  breaks: false,
});

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx <= 0 ? "" : normalized.slice(0, idx);
}

function joinPath(baseDir: string, relative: string): string {
  const base = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = `${base}/${relative}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

function isExternalUrl(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function resolveLocalUrl(href: string, filePath: string | null): string {
  if (!filePath || !href || href.startsWith("#") || isExternalUrl(href)) return href;
  const absolute = joinPath(dirname(filePath), href);
  try {
    return convertFileSrc(absolute);
  } catch {
    return href;
  }
}

/** Strip scripts / event handlers / javascript: URLs from marked HTML. */
export function sanitizeMarkdownHtml(html: string): string {
  return html
    .replace(/<\/?(?:script|iframe|object|embed|link|meta|form)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(?:href|src|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi,
      "",
    );
}

function rewriteAttrUrls(html: string, attr: "src" | "href", absoluteFilePath: string): string {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])([^"']*)\\1`, "gi");
  return html.replace(re, (full, quote: string, value: string) => {
    if (attr === "href" && (value.startsWith("#") || isExternalUrl(value))) return full;
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
