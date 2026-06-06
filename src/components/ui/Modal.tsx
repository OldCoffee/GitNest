import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ModalProps {
  title?: ReactNode;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

export function Modal({ title, onClose, className, children }: ModalProps) {
  return (
    <div className="jb-modal-overlay" onClick={onClose}>
      <div className={cn("jb-modal", className)} onClick={(e) => e.stopPropagation()}>
        {title != null && <div className="jb-modal-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
