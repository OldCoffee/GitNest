/** Editor caret location used for Navigate Back / Forward. */
export interface EditorLocation {
  path: string;
  /** 1-based line */
  line: number;
  /** 0-based column */
  column: number;
}

const MAX_ENTRIES = 80;

function sameLocation(a: EditorLocation | undefined, b: EditorLocation): boolean {
  return (
    !!a &&
    a.path === b.path &&
    a.line === b.line &&
    a.column === b.column
  );
}

/**
 * Browser-style history for go-to-definition / symbol navigation.
 * Cmd+Option+← back, Cmd+Option+→ forward (macOS / IDEA-style).
 */
class NavigationHistory {
  private stack: EditorLocation[] = [];
  private index = -1;
  private silent = false;

  /** Record a jump from `from` to `to` (clears any forward entries). */
  recordJump(from: EditorLocation, to: EditorLocation) {
    if (this.silent) return;
    if (sameLocation(from, to)) return;

    // Drop forward branch.
    if (this.index >= 0 && this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    const top = this.stack[this.index];
    if (!sameLocation(top, from)) {
      this.stack.push(from);
      this.index = this.stack.length - 1;
    }
    this.stack.push(to);
    this.index = this.stack.length - 1;
    this.trim();
  }

  canGoBack(): boolean {
    return this.index > 0;
  }

  canGoForward(): boolean {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  goBack(): EditorLocation | null {
    if (!this.canGoBack()) return null;
    this.index -= 1;
    return this.stack[this.index] ?? null;
  }

  goForward(): EditorLocation | null {
    if (!this.canGoForward()) return null;
    this.index += 1;
    return this.stack[this.index] ?? null;
  }

  /** Apply a history restore without recording a new jump. */
  runSilent(fn: () => void) {
    this.silent = true;
    try {
      fn();
    } finally {
      this.silent = false;
    }
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }

  private trim() {
    if (this.stack.length <= MAX_ENTRIES) return;
    const drop = this.stack.length - MAX_ENTRIES;
    this.stack = this.stack.slice(drop);
    this.index = Math.max(0, this.index - drop);
  }
}

export const navigationHistory = new NavigationHistory();

/** Dispatch until the target editor is mounted and can apply the caret. */
export function scheduleGotoLocation(path: string, line: number, column: number) {
  const detail = { path, line, column };
  let attempts = 0;
  const tick = () => {
    window.dispatchEvent(new CustomEvent("gitnest:goto-location", { detail }));
    attempts += 1;
    if (attempts < 10) window.setTimeout(tick, 40);
  };
  tick();
}
