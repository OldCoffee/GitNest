import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EditorTab } from "../lib/types";
import {
  copyText,
  editorTabAbsolutePath,
  editorTabFileName,
  editorTabFilePath,
  editorTabRelativePath,
  isEditorTabClosable,
} from "../lib/editorTabPaths";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";

interface EditorTabContextMenuProps {
  tab: EditorTab;
  tabIndex: number;
  tabCount: number;
  x: number;
  y: number;
  onClose: () => void;
}

function MenuItem({
  label,
  disabled,
  shortcut,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="jb-context-menu-item"
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      {shortcut && <span className="jb-context-menu-shortcut">{shortcut}</span>}
    </button>
  );
}

function MenuSeparator() {
  return <div className="jb-context-menu-separator" />;
}

function Submenu({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="jb-context-menu-submenu-wrap"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="jb-context-menu-item" disabled={disabled}>
        <span>{label}</span>
        <span className="jb-context-menu-shortcut">›</span>
      </button>
      {open && !disabled && (
        <div className="jb-context-menu jb-context-menu-flyout">{children}</div>
      )}
    </div>
  );
}

function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

export function EditorTabContextMenu({
  tab,
  tabIndex,
  tabCount,
  x,
  y,
  onClose,
}: EditorTabContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const repo = useAppStore((s) => s.repo);
  const editorTabs = useAppStore((s) => s.editorTabs);
  const closeEditorTab = useAppStore((s) => s.closeEditorTab);
  const closeOtherEditorTabs = useAppStore((s) => s.closeOtherEditorTabs);
  const closeAllEditorTabs = useAppStore((s) => s.closeAllEditorTabs);
  const closeUnmodifiedEditorTabs = useAppStore((s) => s.closeUnmodifiedEditorTabs);
  const closeEditorTabsToLeft = useAppStore((s) => s.closeEditorTabsToLeft);
  const closeEditorTabsToRight = useAppStore((s) => s.closeEditorTabsToRight);
  const pinEditorTab = useAppStore((s) => s.pinEditorTab);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);

  const closable = isEditorTabClosable(tab);
  const hasFilePath = editorTabFilePath(tab) != null;
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";
  const hasLeft = tabIndex > 0 && closable;
  const hasRight = tabIndex >= 0 && tabIndex < tabCount - 1 && closable;
  const hasOtherClosable =
    editorTabs.some((t) => t.id !== tab.id && isEditorTabClosable(t));
  const hasAnyClosable = editorTabs.some((t) => isEditorTabClosable(t));
  const hasUnmodifiedClosable = editorTabs.some(
    (t) =>
      isEditorTabClosable(t) &&
      !t.pinned &&
      t.id !== tab.id,
  );

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

  async function runAsync(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      appendVcsOutput(String(e));
    }
    onClose();
  }

  async function copyPath(kind: "absolute" | "relative" | "name" | "reference") {
    const abs = editorTabAbsolutePath(tab, repo?.path);
    const rel = editorTabRelativePath(tab);
    const name = editorTabFileName(tab);
    if (kind === "absolute" && abs) await copyText(abs);
    if (kind === "relative" && rel) await copyText(rel);
    if (kind === "name" && name) await copyText(name);
    if (kind === "reference" && rel) await copyText(rel);
  }

  async function revealInExplorer() {
    const abs = editorTabAbsolutePath(tab, repo?.path);
    if (!abs) return;
    await revealItemInDir(abs);
  }

  async function openInDefaultApp() {
    const abs = editorTabAbsolutePath(tab, repo?.path);
    if (!abs) return;
    await openPath(abs);
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 420),
  };

  return (
    <div ref={menuRef} className="jb-context-menu" style={menuStyle}>
      <MenuItem
        label={t("editorTabMenu.close")}
        disabled={!closable}
        shortcut={`${mod}W`}
        onClick={() => run(() => closeEditorTab(tab.id))}
      />
      <MenuItem
        label={t("editorTabMenu.closeOthers")}
        disabled={!hasOtherClosable}
        onClick={() => run(() => closeOtherEditorTabs(tab.id))}
      />
      <MenuItem
        label={t("editorTabMenu.closeAll")}
        disabled={!hasAnyClosable}
        onClick={() => run(() => closeAllEditorTabs())}
      />
      <MenuItem
        label={t("editorTabMenu.closeUnmodified")}
        disabled={!hasUnmodifiedClosable}
        onClick={() => run(() => closeUnmodifiedEditorTabs())}
      />
      <MenuItem
        label={t("editorTabMenu.closeLeft")}
        disabled={!hasLeft}
        onClick={() => run(() => closeEditorTabsToLeft(tab.id))}
      />
      <MenuItem
        label={t("editorTabMenu.closeRight")}
        disabled={!hasRight}
        onClick={() => run(() => closeEditorTabsToRight(tab.id))}
      />

      <MenuSeparator />

      <Submenu label={t("editorTabMenu.copyPath")} disabled={!hasFilePath}>
        <MenuItem
          label={t("editorTabMenu.copyAbsolute")}
          onClick={() => void runAsync(() => copyPath("absolute"))}
        />
        <MenuItem
          label={t("editorTabMenu.copyRelative")}
          onClick={() => void runAsync(() => copyPath("relative"))}
        />
        <MenuItem
          label={t("editorTabMenu.copyFileName")}
          onClick={() => void runAsync(() => copyPath("name"))}
        />
        <MenuItem
          label={t("editorTabMenu.copyReference")}
          onClick={() => void runAsync(() => copyPath("reference"))}
        />
      </Submenu>

      <MenuSeparator />

      <MenuItem label={t("editorTabMenu.splitRight")} disabled onClick={() => {}} />
      <MenuItem label={t("editorTabMenu.splitMoveRight")} disabled onClick={() => {}} />
      <MenuItem label={t("editorTabMenu.splitDown")} disabled onClick={() => {}} />
      <MenuItem label={t("editorTabMenu.splitMoveDown")} disabled onClick={() => {}} />

      <MenuSeparator />

      <MenuItem
        label={tab.pinned ? t("editorTabMenu.unpinTab") : t("editorTabMenu.pinTab")}
        disabled={!closable}
        onClick={() => run(() => pinEditorTab(tab.id, !tab.pinned))}
      />
      <MenuItem label={t("editorTabMenu.openNewWindow")} disabled onClick={() => {}} />

      <MenuSeparator />

      <MenuItem
        label={t("editorTabMenu.configureTabs")}
        onClick={() => run(() => openSettingsEditor())}
      />

      <MenuSeparator />

      <Submenu label={t("editorTabMenu.openIn")} disabled={!hasFilePath}>
        <MenuItem
          label={isMacPlatform() ? t("editorTabMenu.revealFinder") : t("editorTabMenu.revealExplorer")}
          onClick={() => void runAsync(revealInExplorer)}
        />
        <MenuItem
          label={t("editorTabMenu.openDefaultApp")}
          onClick={() => void runAsync(openInDefaultApp)}
        />
      </Submenu>
    </div>
  );
}
