# Commit / Git tool window overrides

> Overrides `design-system/gitnest/MASTER.md` for the left Git commit tool window.

## Rules
- Use `ToolWindowShell` + `Tabs variant="tool"`
- File groups use `jb-file-group-header` (sticky, left accent) — not ToolWindowHeader
- Commit composer sits in `jb-commit-footer` with denser form spacing
- Subject length soft-warn after 50 chars; errors via `InlineAlert`
- Stash rows keep message + mono ref + compact action buttons
