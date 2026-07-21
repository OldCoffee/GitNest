# Icons

> Shared icon system for GitNest chrome and tool windows.

## Rules
- Import from `src/components/ui/icons` (re-exported via `components/ui`)
- Always wrap with `Icon` sizes: `xs` 12 · `sm` 14 · `md` 16 · `lg` 18
- Glyphs are 16×16, `fill="currentColor"` — color inherits from parent
- Activity bar uses `lg`; toolbar / status / project toolbar use `sm`–`md`
- Search field uses `SearchIcon` (no unicode glyphs)
- Prefer `IconButton` + icon for icon-only actions
- File entries use `FileTypeIcon` (per-extension colored badge) — not a single generic `FileIcon`
- Chevrons/carets: use `ChevronRightIcon` (collapsed/submenu) and `ChevronDownIcon` (open/dropdown caret) — no `▸`/`▾` unicode glyphs
- Tag refs (Git Log ref badges, etc.) use `TagIcon` — no `⌖` unicode glyph
