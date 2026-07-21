# IDE Shell overrides

> Overrides `design-system/gitnest/MASTER.md` for the main IDE chrome.

## Rules
- Activity bar, main toolbar: `--surface-chrome` (`--jb-toolbar`)
- Left / bottom panels: `--surface-panel` (`--jb-panel`)
- Editor canvas: `--surface-canvas` (`--jb-bg`)
- Status bar: align with panel surface; keep 24px min-height
- Left tools must use `ToolWindowShell`
- Bottom tools use shared `Tabs` (tool/terminal variants)
- Icon buttons: 22 / 26 / 32 via `IconButton` sizes
- Scrollbars: thin tokenized chrome (`--jb-scrollbar-*`); project tree vertical + editor tabs horizontal (`--jb-tab-scrollbar-*`, hairline + short thumb); cold open never restores prior editor tabs; respect `prefers-reduced-motion`
- Tab overflow: fade edges when scrollable; wheel maps to horizontal scroll
- Do not introduce marketing cards inside the IDE shell
