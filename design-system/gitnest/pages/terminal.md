# Terminal

> Extends `design-system/gitnest/MASTER.md`

## Purpose
Bottom PTY sessions with dense session chrome.

## Rules
- Session strip uses `TabBar variant="terminal"` + `Tab` with `jb-terminal-tab` domain classes.
- Theme colors from tokens: `--jb-term-bg`, `--jb-term-fg`, `--jb-term-cursor`, `--jb-term-selection`.
- Font: `var(--jb-mono)`.
- Selection overlay CSS must use `--jb-term-selection` (never legacy IDE blue).
