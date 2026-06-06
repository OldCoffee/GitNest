export function extension(path: string): string | null {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return base.slice(dot + 1).toLowerCase();
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
]);

export function isImagePath(path: string): boolean {
  const ext = extension(path);
  return ext !== null && IMAGE_EXTENSIONS.has(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function previewKindLabel(kind: string): string {
  switch (kind) {
    case "text_diff":
      return "Diff";
    case "text_content":
      return "File";
    case "image":
      return "Image";
    case "binary":
      return "Binary";
    case "deleted":
      return "Deleted";
    default:
      return kind;
  }
}
