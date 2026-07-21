import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useT } from "../../context/PreferencesContext";

export interface ConfirmDialogProps {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="jb-modal-text">{message}</div>
      <div className="jb-modal-actions">
        <Button variant="action" onClick={onCancel}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}

export interface AlertDialogProps {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  onClose: () => void;
}

export function AlertDialog({ title, message, confirmLabel, onClose }: AlertDialogProps) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="jb-modal-text">{message}</div>
      <div className="jb-modal-actions">
        <Button variant="primary" onClick={onClose}>
          {confirmLabel ?? t("common.ok")}
        </Button>
      </div>
    </Modal>
  );
}

export interface PromptDialogProps {
  title?: ReactNode;
  message?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  title,
  message,
  placeholder,
  defaultValue,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const t = useT();
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal title={title} onClose={onCancel}>
      {message != null && <div className="jb-modal-text">{message}</div>}
      <input
        ref={inputRef}
        className="jb-input jb-modal-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
      <div className="jb-modal-actions">
        <Button variant="action" onClick={onCancel}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button variant="primary" disabled={!value.trim()} onClick={submit}>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
