import { cn } from "../../lib/utils";
import { extension } from "../../lib/fileType";
import type { IconSize } from "./icons";

/** Distinct file-type keys used for project/tree/tab icons. */
export type FileIconKind =
  | "java"
  | "class"
  | "kotlin"
  | "xml"
  | "pom"
  | "markdown"
  | "json"
  | "yaml"
  | "properties"
  | "txt"
  | "sql"
  | "shell"
  | "bat"
  | "javascript"
  | "typescript"
  | "tsx"
  | "css"
  | "html"
  | "image"
  | "svg"
  | "rust"
  | "python"
  | "go"
  | "toml"
  | "gradle"
  | "dockerfile"
  | "git"
  | "lock"
  | "default";

interface FileIconMeta {
  badge: string;
  label: string;
}

const META: Record<FileIconKind, FileIconMeta> = {
  java: { badge: "J", label: "Java" },
  class: { badge: "C", label: "Java class" },
  kotlin: { badge: "Kt", label: "Kotlin" },
  xml: { badge: "X", label: "XML" },
  pom: { badge: "M", label: "Maven POM" },
  markdown: { badge: "MD", label: "Markdown" },
  json: { badge: "{}", label: "JSON" },
  yaml: { badge: "Y", label: "YAML" },
  properties: { badge: "P", label: "Properties" },
  txt: { badge: "T", label: "Text" },
  sql: { badge: "SQL", label: "SQL" },
  shell: { badge: "SH", label: "Shell" },
  bat: { badge: "BAT", label: "Batch" },
  javascript: { badge: "JS", label: "JavaScript" },
  typescript: { badge: "TS", label: "TypeScript" },
  tsx: { badge: "TX", label: "TSX" },
  css: { badge: "CSS", label: "CSS" },
  html: { badge: "HT", label: "HTML" },
  image: { badge: "IMG", label: "Image" },
  svg: { badge: "SVG", label: "SVG" },
  rust: { badge: "RS", label: "Rust" },
  python: { badge: "PY", label: "Python" },
  go: { badge: "GO", label: "Go" },
  toml: { badge: "TM", label: "TOML" },
  gradle: { badge: "G", label: "Gradle" },
  dockerfile: { badge: "D", label: "Dockerfile" },
  git: { badge: "GI", label: "Git" },
  lock: { badge: "LK", label: "Lockfile" },
  default: { badge: "F", label: "File" },
};

const EXT_KIND: Record<string, FileIconKind> = {
  java: "java",
  class: "class",
  kt: "kotlin",
  kts: "kotlin",
  xml: "xml",
  md: "markdown",
  markdown: "markdown",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  properties: "properties",
  txt: "txt",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  bat: "bat",
  cmd: "bat",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "tsx",
  ts: "typescript",
  tsx: "tsx",
  css: "css",
  scss: "css",
  less: "css",
  html: "html",
  htm: "html",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  ico: "image",
  bmp: "image",
  svg: "svg",
  rs: "rust",
  py: "python",
  go: "go",
  toml: "toml",
  gradle: "gradle",
  groovy: "gradle",
  lock: "lock",
};

export function fileIconKind(path: string): FileIconKind {
  const base = (path.split(/[\\/]/).pop() ?? path).toLowerCase();
  if (base === "pom.xml") return "pom";
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  if (base === ".gitignore" || base === ".gitattributes" || base === ".gitmodules") return "git";
  if (
    base === "package-lock.json" ||
    base === "yarn.lock" ||
    base === "pnpm-lock.yaml" ||
    base === "cargo.lock"
  ) {
    return "lock";
  }
  if (base.endsWith(".gradle") || base.endsWith(".gradle.kts")) return "gradle";
  const ext = extension(path);
  if (!ext) return "default";
  return EXT_KIND[ext] ?? "default";
}

export function fileIconMeta(path: string): FileIconMeta {
  return META[fileIconKind(path)];
}

const SIZE_CLASS: Record<IconSize, string> = {
  xs: "jb-ftype-xs",
  sm: "jb-ftype-sm",
  md: "jb-ftype-md",
  lg: "jb-ftype-lg",
};

export function FileTypeIcon({
  path,
  size = "sm",
  className,
}: {
  path: string;
  size?: IconSize;
  className?: string;
}) {
  const kind = fileIconKind(path);
  const meta = META[kind];
  return (
    <span
      className={cn("jb-ftype-icon", `jb-ftype-${kind}`, SIZE_CLASS[size], className)}
      title={meta.label}
      aria-hidden
    >
      <span className="jb-ftype-badge">{meta.badge}</span>
    </span>
  );
}
