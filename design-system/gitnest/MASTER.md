# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/gitnest/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** GitNest  
**Generated:** 2026-07-20  
**Category:** Developer Tool / Desktop IDE (Tauri + React)  
**Brand Direction:** Independent product identity — precision, restrained, professional  
**Design Dials:** Variance 5/10 | Motion 3/10 | Density 8/10  

---

## Brand

- **Name signal:** GitNest must remain recognizable on Welcome without breaking IDE density.
- **Tone:** Graphite neutral + GitNest Blue accent. No purple glow, no terracotta, no marketing-card overload inside the IDE shell.
- **Density:** High information density (IDE). Compact rows (22–26px), 11–13px type.
- **Motion:** 120–220ms ease, state/space only. Respect `prefers-reduced-motion`.

## Color Palette (semantic)

### Shared accent
| Role | Hex | Token |
|------|-----|-------|
| Accent | `#3D7EFF` | `--jb-accent` / `--color-accent` |
| Accent Hover | `#5B91FF` (dark) / `#1F5FD6` (light) | `--jb-accent-hover` |
| Focus Ring | `#3D7EFF` @ 50% | `--jb-focus-ring` |

### Dark theme
| Role | Hex | Token |
|------|-----|-------|
| Canvas | `#14161B` | `--jb-bg` / `--surface-canvas` |
| Chrome | `#262B35` | `--jb-toolbar` / `--surface-chrome` |
| Panel | `#1E222A` | `--jb-panel` / `--surface-panel` |
| Overlay / Popup | `#252A34` | `--jb-popup` / `--surface-overlay` |
| Border | `#343B48` | `--jb-border` |
| Text | `#C4C8D0` | `--jb-text` |
| Text Strong | `#EEF0F4` | `--jb-text-strong` |
| Text Muted | `#8B929E` | `--jb-text-dim` |
| Success | `#499C54` | `--jb-success` |
| Warning | `#CCA700` | `--jb-warning` |
| Error | `#CF5656` | `--jb-error` |

### Light theme
| Role | Hex | Token |
|------|-----|-------|
| Canvas | `#EEF1F6` | `--jb-bg` |
| Chrome | `#E4E8F0` | `--jb-toolbar` |
| Panel | `#FFFFFF` | `--jb-panel` |
| Overlay / Popup | `#FFFFFF` | `--jb-popup` |
| Border | `#C9D0DB` | `--jb-border` |
| Text | `#1C2330` | `--jb-text` |
| Text Strong | `#0B1220` | `--jb-text-strong` |
| Text Muted | `#5C677A` | `--jb-text-dim` |
| Success | `#2D8A3E` | `--jb-success` |
| Warning | `#9A7D00` | `--jb-warning` |
| Error | `#C0392B` | `--jb-error` |

**Do not** use raw green as primary CTA. Accent is GitNest Blue. Success green is status-only.

## Typography
- UI: `Inter`, system-ui fallback (desktop app may ship without webfont; keep system stack as primary for Tauri).
- Mono: `--jb-mono` for diff / terminal / code.
- Scale: `--jb-font-xs` 11px · `--jb-font-sm` 12px · `--jb-font-md` 13px
- Body line-height ~1.4–1.5; list rows single-line.

## Spacing / Radius / Shadow
| Token | Value |
|-------|-------|
| `--jb-space-1` | 4px |
| `--jb-space-2` | 8px |
| `--jb-space-3` | 12px |
| `--jb-space-4` | 16px |
| `--jb-radius` | 4px |
| `--jb-radius-lg` | 6px |
| `--jb-radius-xl` | 10px (Welcome only) |
| `--jb-shadow` | elevated popup/modal |
| `--jb-row-h` | 24px |

## Layout shells (required)
1. **ToolWindowShell** — left panels: Project / Git / Search / PR / MR  
   `Panel` + `ToolWindowHeader` + optional `Tabs` + `PanelBody`
2. **EditorTabShell** — Settings / Branches / embedded docs  
   page header + fill or scroll body
3. **IDE Chrome** — toolbar / activity bar / status bar share `--surface-chrome` vs `--surface-panel` consistently

## Component rules
- All clickable controls go through `components/ui` (`Button`, `IconButton`, …).
- Icons: use `components/ui/icons` (`Icon` wrapper, 16×16 filled glyphs, sizes `xs|sm|md|lg`). Do not inline ad-hoc SVGs in chrome.
- No new bare `jb-btn-primary` in feature code.
- One `Tabs` API with variants: `editor | tool | terminal | preview`.
- Lists use `ListRow` / `TreeRow` densities: `compact | default | comfortable`.
- Forms use `FormField` + styled `Input` / `Select` / `Checkbox` / `TextArea`.
- Context menus use `ContextMenu` / `ContextMenuItem` primitives.
- Errors use `InlineAlert`, not raw `jb-text-error` divs.
- Icon-only buttons need `aria-label` or `title`.
- Visible `:focus-visible` ring on interactive elements.

## Page notes
- **Welcome:** brand-first hero allowed; still use brand tokens (accent blue, graphite). Radius may use `--jb-radius-xl`.
- **IDE shell:** flat, dense, no card chrome in tool windows.
- **Git Log / Diff:** keep domain colors (`--jb-graph-*`, diff add/del) but share toolbar/header patterns. Commit graph SVG in LogEditor is domain visualization — exempt from icons.tsx-only rule.

## Anti-patterns
- Mixing purple/indigo marketing gradients inside IDE
- Gray-on-gray low contrast
- Hover-only affordances without keyboard focus
- Emoji as icons
- Instant 0ms state changes without loading feedback for async work
- Horizontal scroll in tool windows
