import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useRef } from "react";
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
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from "./ui";

interface EditorTabContextMenuProps {
  tab: EditorTab;
  tabIndex: number;
  tabCount: number;
  x: number;
  y: number;
  onClose: () => void;
  onRequestClose?: (tab: EditorTab) => void;
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
  onRequestClose,
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
    <ContextMenu menuRef={menuRef} style={menuStyle}>
      <ContextMenuItem
        label={t("editorTabMenu.close")}
        disabled={!closable}
        shortcut={`${mod}W`}
        onClick={() => run(() => (onRequestClose ? onRequestClose(tab) : closeEditorTab(tab.id)))}
      />
      <ContextMenuItem
        label={t("editorTabMenu.closeOthers")}
        disabled={!hasOtherClosable}
        onClick={() => run(() => closeOtherEditorTabs(tab.id))}
      />
      <ContextMenuItem
        label={t("editorTabMenu.closeAll")}
        disabled={!hasAnyClosable}
        onClick={() => run(() => closeAllEditorTabs())}
      />
      <ContextMenuItem
        label={t("editorTabMenu.closeUnmodified")}
        disabled={!hasUnmodifiedClosable}
        onClick={() => run(() => closeUnmodifiedEditorTabs())}
      />
      <ContextMenuItem
        label={t("editorTabMenu.closeLeft")}
        disabled={!hasLeft}
        onClick={() => run(() => closeEditorTabsToLeft(tab.id))}
      />
      <ContextMenuItem
        label={t("editorTabMenu.closeRight")}
        disabled={!hasRight}
        onClick={() => run(() => closeEditorTabsToRight(tab.id))}
      />

      <ContextMenuSeparator />

      <ContextMenuSubmenu label={t("editorTabMenu.copyPath")} disabled={!hasFilePath}>
        <ContextMenuItem
          label={t("editorTabMenu.copyAbsolute")}
          onClick={() => void runAsync(() => copyPath("absolute"))}
        />
        <ContextMenuItem
          label={t("editorTabMenu.copyRelative")}
          onClick={() => void runAsync(() => copyPath("relative"))}
        />
        <ContextMenuItem
          label={t("editorTabMenu.copyFileName")}
          onClick={() => void runAsync(() => copyPath("name"))}
        />
        <ContextMenuItem
          label={t("editorTabMenu.copyReference")}
          onClick={() => void runAsync(() => copyPath("reference"))}
        />
      </ContextMenuSubmenu>

      <ContextMenuSeparator />

      <ContextMenuItem label={t("editorTabMenu.splitRight")} disabled onClick={() => {}} />
      <ContextMenuItem label={t("editorTabMenu.splitMoveRight")} disabled onClick={() => {}} />
      <ContextMenuItem label={t("editorTabMenu.splitDown")} disabled onClick={() => {}} />
      <ContextMenuItem label={t("editorTabMenu.splitMoveDown")} disabled onClick={() => {}} />

      <ContextMenuSeparator />

      <ContextMenuItem
        label={tab.pinned ? t("editorTabMenu.unpinTab") : t("editorTabMenu.pinTab")}
        disabled={!closable}
        onClick={() => run(() => pinEditorTab(tab.id, !tab.pinned))}
      />
      <ContextMenuItem label={t("editorTabMenu.openNewWindow")} disabled onClick={() => {}} />

      <ContextMenuSeparator />

      <ContextMenuItem
        label={t("editorTabMenu.configureTabs")}
        onClick={() => run(() => openSettingsEditor())}
      />

      <ContextMenuSeparator />

      <ContextMenuSubmenu label={t("editorTabMenu.openIn")} disabled={!hasFilePath}>
        <ContextMenuItem
          label={isMacPlatform() ? t("editorTabMenu.revealFinder") : t("editorTabMenu.revealExplorer")}
          onClick={() => void runAsync(revealInExplorer)}
        />
        <ContextMenuItem
          label={t("editorTabMenu.openDefaultApp")}
          onClick={() => void runAsync(openInDefaultApp)}
        />
      </ContextMenuSubmenu>
    </ContextMenu>
  );
}
