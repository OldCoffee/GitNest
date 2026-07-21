import { useEffect, useRef } from "react";
import { useT } from "../context/PreferencesContext";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "./ui";

function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

export interface EditorContextMenuProps {
  x: number;
  y: number;
  javaEnabled: boolean;
  onGoToDefinition: () => void;
  onFindUsages: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export function EditorContextMenu({
  x,
  y,
  javaEnabled,
  onGoToDefinition,
  onFindUsages,
  onCopy,
  onClose,
}: EditorContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <ContextMenu
      menuRef={menuRef}
      style={{
        left: Math.min(x, window.innerWidth - 240),
        top: Math.min(y, window.innerHeight - 180),
      }}
    >
      <ContextMenuItem
        label={t("editorMenu.goToDefinition")}
        shortcut={`F12 / ${mod}B`}
        disabled={!javaEnabled}
        onClick={() => run(onGoToDefinition)}
      />
      <ContextMenuItem
        label={t("editorMenu.findUsages")}
        shortcut="⇧F12"
        disabled={!javaEnabled}
        onClick={() => run(onFindUsages)}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("editorMenu.copy")}
        shortcut={`${mod}C`}
        onClick={() => run(onCopy)}
      />
    </ContextMenu>
  );
}
