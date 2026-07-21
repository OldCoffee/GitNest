import { documentStore } from "../editor/documentStore";
import { uiConfirm } from "./uiPrompt";

/** Ask before discarding dirty buffers (close repo / quit). Returns true to proceed. */
export async function confirmDiscardUnsaved(options: {
  title: string;
  message: (count: number) => string;
  confirmLabel?: string;
}): Promise<boolean> {
  const dirty = documentStore.dirtyPaths();
  if (dirty.length === 0) return true;
  return uiConfirm({
    title: options.title,
    message: options.message(dirty.length),
    confirmLabel: options.confirmLabel,
    danger: true,
  });
}
