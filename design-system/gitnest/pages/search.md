# Search tool window overrides

> Overrides `design-system/gitnest/MASTER.md` for workspace search.

## Rules
- Toolbar uses `ToolbarStrip` with query row + options row
- Show live status: searching / `{count} results in {files} files`
- Result rows: path + line pill + mono preview; active row uses left accent bar
- Highlight the first query match in preview with `jb-search-mark`
- Errors use `InlineAlert`
