import { useSyncExternalStore } from "react";
import { api } from "../lib/api";
import { javaLspClient, isJdtUri } from "./lspClient";

export interface DocumentSelection {
  anchor: number;
  head: number;
}

export interface DocumentSnapshot {
  path: string;
  text: string;
  savedText: string;
  version: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isBinary: boolean;
  tooLarge: boolean;
  sizeBytes: number;
  modifiedMs: number | null;
  externalText: string | null;
  selection: DocumentSelection | null;
  dirty: boolean;
  readOnly: boolean;
  virtual: boolean;
}

type Listener = () => void;

export function isClassFilePath(path: string): boolean {
  return !isJdtUri(path) && path.toLowerCase().endsWith(".class");
}

function initialDocument(path: string): DocumentSnapshot {
  return {
    path,
    text: "",
    savedText: "",
    version: 0,
    loading: true,
    saving: false,
    error: null,
    isBinary: false,
    tooLarge: false,
    sizeBytes: 0,
    modifiedMs: null,
    externalText: null,
    selection: null,
    dirty: false,
    readOnly: false,
    virtual: false,
  };
}

export function isAbsoluteFsPath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

class DocumentStore {
  private documents = new Map<string, DocumentSnapshot>();
  private listeners = new Map<string, Set<Listener>>();
  private loading = new Map<string, Promise<void>>();

  get(path: string): DocumentSnapshot {
    let document = this.documents.get(path);
    if (!document) {
      document = initialDocument(path);
      this.documents.set(path, document);
      void this.load(path);
    }
    return document;
  }

  subscribe(path: string, listener: Listener): () => void {
    const listeners = this.listeners.get(path) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(path, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(path);
    };
  }

  openVirtual(
    path: string,
    text: string,
    options?: { readOnly?: boolean },
  ): DocumentSnapshot {
    const snapshot: DocumentSnapshot = {
      ...initialDocument(path),
      text,
      savedText: text,
      version: 1,
      loading: false,
      sizeBytes: new TextEncoder().encode(text).length,
      readOnly: options?.readOnly ?? true,
      virtual: true,
      dirty: false,
    };
    this.replace(path, snapshot);
    return snapshot;
  }

  async load(path: string, force = false): Promise<void> {
    if (!force) {
      const inFlight = this.loading.get(path);
      if (inFlight) return inFlight;
      const current = this.documents.get(path);
      if (current && !current.loading && current.version > 0) return;
    }

    this.patch(path, { loading: true, error: null });

    const request = (async () => {
      if (isJdtUri(path)) {
        const text = await javaLspClient.classFileContents(path);
        this.replace(path, {
          ...this.getWithoutLoad(path),
          text,
          savedText: text,
          version: this.getWithoutLoad(path).version + 1,
          loading: false,
          error: null,
          isBinary: false,
          tooLarge: false,
          sizeBytes: new TextEncoder().encode(text).length,
          modifiedMs: null,
          externalText: null,
          dirty: false,
          readOnly: true,
          virtual: true,
        });
        return;
      }

      if (isClassFilePath(path)) {
        const data = await api.decompileClassFile(path);
        this.replace(path, {
          ...this.getWithoutLoad(path),
          text: data.content,
          savedText: data.content,
          version: this.getWithoutLoad(path).version + 1,
          loading: false,
          error: null,
          isBinary: false,
          tooLarge: false,
          sizeBytes: data.sizeBytes,
          modifiedMs: null,
          externalText: null,
          dirty: false,
          readOnly: true,
          virtual: true,
        });
        return;
      }

      const data = isAbsoluteFsPath(path)
        ? await api.readAbsoluteTextFile(path)
        : await api.readTextFile(path);
      const editable = !data.is_binary && !data.too_large;
      this.replace(path, {
        ...this.getWithoutLoad(path),
        text: editable ? data.content : "",
        savedText: editable ? data.content : "",
        version: this.getWithoutLoad(path).version + 1,
        loading: false,
        error: null,
        isBinary: data.is_binary,
        tooLarge: data.too_large,
        sizeBytes: data.size_bytes,
        modifiedMs: data.modified_ms,
        externalText: null,
        dirty: false,
        readOnly: false,
        virtual: false,
      });
    })()
      .catch((error: unknown) => {
        this.patch(path, { loading: false, error: String(error) });
      })
      .finally(() => {
        this.loading.delete(path);
      });

    this.loading.set(path, request);
    return request;
  }

  update(path: string, text: string, selection?: DocumentSelection): void {
    const current = this.get(path);
    if (current.readOnly) return;
    this.replace(path, {
      ...current,
      text,
      selection: selection ?? current.selection,
      version: current.version + 1,
      dirty: text !== current.savedText,
      error: null,
    });
  }

  setSelection(path: string, selection: DocumentSelection): void {
    this.patch(path, { selection });
  }

  async save(path: string, force = false): Promise<void> {
    const current = this.get(path);
    if (
      current.saving ||
      !current.dirty ||
      current.isBinary ||
      current.tooLarge ||
      current.readOnly ||
      current.virtual ||
      isJdtUri(path)
    ) {
      return;
    }

    this.patch(path, { saving: true, error: null });
    try {
      const modifiedMs = await api.writeTextFile(
        path,
        current.text,
        current.modifiedMs,
        force,
      );
      const latest = this.get(path);
      this.replace(path, {
        ...latest,
        savedText: current.text,
        dirty: latest.text !== current.text,
        saving: false,
        modifiedMs,
        externalText: null,
        error: null,
      });
    } catch (error) {
      const message = String(error);
      if (message.includes("FILE_MODIFIED")) {
        const disk = await api.readTextFile(path);
        this.patch(path, {
          saving: false,
          externalText: disk.content,
          modifiedMs: disk.modified_ms,
          error: message,
        });
      } else {
        this.patch(path, { saving: false, error: message });
      }
      throw error;
    }
  }

  acceptExternal(path: string): void {
    const current = this.get(path);
    if (current.externalText == null) return;
    this.replace(path, {
      ...current,
      text: current.externalText,
      savedText: current.externalText,
      externalText: null,
      dirty: false,
      error: null,
      version: current.version + 1,
    });
  }

  close(path: string, force = false): boolean {
    const current = this.documents.get(path);
    if (!current) return true;
    if (current.dirty && !force) return false;
    this.documents.delete(path);
    this.loading.delete(path);
    this.emit(path);
    return true;
  }

  isDirty(path: string): boolean {
    return this.documents.get(path)?.dirty ?? false;
  }

  /** Snapshot without triggering a disk/LSP load (for tab titles, etc.). */
  peek(path: string): DocumentSnapshot | null {
    return this.documents.get(path) ?? null;
  }

  has(path: string): boolean {
    return this.documents.has(path);
  }

  dirtyPaths(): string[] {
    return [...this.documents.values()]
      .filter((document) => document.dirty)
      .map((document) => document.path);
  }

  private patch(path: string, patch: Partial<DocumentSnapshot>): void {
    this.replace(path, { ...this.getWithoutLoad(path), ...patch });
  }

  private getWithoutLoad(path: string): DocumentSnapshot {
    const current = this.documents.get(path);
    if (current) return current;
    const created = initialDocument(path);
    this.documents.set(path, created);
    return created;
  }

  private replace(path: string, document: DocumentSnapshot): void {
    this.documents.set(path, document);
    this.emit(path);
  }

  private emit(path: string): void {
    for (const listener of this.listeners.get(path) ?? []) listener();
  }
}

export const documentStore = new DocumentStore();

export function useDocument(path: string): DocumentSnapshot {
  return useSyncExternalStore(
    (listener) => documentStore.subscribe(path, listener),
    () => documentStore.get(path),
    () => documentStore.get(path),
  );
}

/** Dirty indicator for tab titles — does not trigger a file load. */
export function useDocumentDirty(path: string): boolean {
  return useSyncExternalStore(
    (listener) => documentStore.subscribe(path, listener),
    () => documentStore.isDirty(path),
    () => documentStore.isDirty(path),
  );
}
