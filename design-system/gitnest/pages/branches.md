# Branches

> Extends `design-system/gitnest/MASTER.md`

## Purpose
Branch management tab inside the editor area.

## Rules
- Page chrome: `EditorTabShell`.
- Tree: shared branch icons + `TreeRow` for folders/sections.
- Destructive delete: `ConfirmDialog` with `danger` (no native `confirm`).
- Context menu: `ContextMenu*` + `ConfirmDialog` / `PromptDialog`.
