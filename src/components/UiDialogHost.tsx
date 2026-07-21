import { useEffect, useState } from "react";
import { AlertDialog, ConfirmDialog, PromptDialog } from "../components/ui";
import {
  setUiAlertListener,
  setUiConfirmListener,
  setUiPromptListener,
  type UiAlertOptions,
  type UiConfirmOptions,
  type UiPromptOptions,
} from "../lib/uiPrompt";

type PromptState = UiPromptOptions & {
  resolve: (value: string | null) => void;
};

type ConfirmState = UiConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type AlertState = UiAlertOptions & {
  resolve: () => void;
};

/** Hosts app-wide dialogs for non-React call sites (no native browser dialogs). */
export function UiDialogHost() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    setUiPromptListener((req) => setPrompt(req));
    setUiConfirmListener((req) => setConfirm(req));
    setUiAlertListener((req) => setAlert(req));
    return () => {
      setUiPromptListener(null);
      setUiConfirmListener(null);
      setUiAlertListener(null);
    };
  }, []);

  return (
    <>
      {prompt && (
        <PromptDialog
          title={prompt.title}
          message={prompt.message}
          placeholder={prompt.placeholder}
          defaultValue={prompt.defaultValue}
          confirmLabel={prompt.confirmLabel}
          cancelLabel={prompt.cancelLabel}
          onConfirm={(value) => {
            const resolve = prompt.resolve;
            setPrompt(null);
            resolve(value);
          }}
          onCancel={() => {
            const resolve = prompt.resolve;
            setPrompt(null);
            resolve(null);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          danger={confirm.danger}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          onConfirm={() => {
            const resolve = confirm.resolve;
            setConfirm(null);
            resolve(true);
          }}
          onCancel={() => {
            const resolve = confirm.resolve;
            setConfirm(null);
            resolve(false);
          }}
        />
      )}
      {alert && (
        <AlertDialog
          title={alert.title}
          message={alert.message}
          confirmLabel={alert.confirmLabel}
          onClose={() => {
            const resolve = alert.resolve;
            setAlert(null);
            resolve();
          }}
        />
      )}
    </>
  );
}
