export interface UiPromptOptions {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface UiConfirmOptions {
  title?: string;
  message: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface UiAlertOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

type PromptRequest = UiPromptOptions & {
  resolve: (value: string | null) => void;
};

type ConfirmRequest = UiConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type AlertRequest = UiAlertOptions & {
  resolve: () => void;
};

type PromptListener = (req: PromptRequest) => void;
type ConfirmListener = (req: ConfirmRequest) => void;
type AlertListener = (req: AlertRequest) => void;

let promptListener: PromptListener | null = null;
let confirmListener: ConfirmListener | null = null;
let alertListener: AlertListener | null = null;

const pendingPrompts: PromptRequest[] = [];
const pendingConfirms: ConfirmRequest[] = [];
const pendingAlerts: AlertRequest[] = [];

function flush<T>(queue: T[], listener: ((req: T) => void) | null) {
  if (!listener) return;
  while (queue.length > 0) {
    listener(queue.shift()!);
  }
}

export function setUiPromptListener(listener: PromptListener | null) {
  promptListener = listener;
  flush(pendingPrompts, listener);
}

export function setUiConfirmListener(listener: ConfirmListener | null) {
  confirmListener = listener;
  flush(pendingConfirms, listener);
}

export function setUiAlertListener(listener: AlertListener | null) {
  alertListener = listener;
  flush(pendingAlerts, listener);
}

/** App-hosted PromptDialog (queued until UiDialogHost mounts). */
export function uiPrompt(options: UiPromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const req: PromptRequest = { ...options, resolve };
    if (promptListener) promptListener(req);
    else pendingPrompts.push(req);
  });
}

/** App-hosted ConfirmDialog (queued until UiDialogHost mounts). */
export function uiConfirm(options: UiConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const req: ConfirmRequest = { ...options, resolve };
    if (confirmListener) confirmListener(req);
    else pendingConfirms.push(req);
  });
}

/** App-hosted AlertDialog (queued until UiDialogHost mounts). */
export function uiAlert(options: UiAlertOptions | string): Promise<void> {
  const normalized: UiAlertOptions =
    typeof options === "string" ? { message: options } : options;
  return new Promise((resolve) => {
    const req: AlertRequest = { ...normalized, resolve };
    if (alertListener) alertListener(req);
    else pendingAlerts.push(req);
  });
}
