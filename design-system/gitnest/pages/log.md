# Log

> Extends `design-system/gitnest/MASTER.md`

## Purpose
Commit history with graph, filters, and detail — domain density over shell chrome.

## Rules
- Filter path actions use shared `Button` / `Button variant="primary"`.
- File tree in detail uses `TreeRow` + shared icons.
- Context menu uses `ContextMenu*`.
- Graph lane colors may use `--jb-graph-*` (domain exemption).
- Do not force `EditorTabShell` — Log is a custom split layout.
