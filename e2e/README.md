# E2E 双车道

GitNest 用两条互补车道覆盖「开仓 → 变更 → stage → commit → log」主路径。

| 车道 | 命令 | 驱动 | 门禁 |
|------|------|------|------|
| Mock DOM | `npm run test:e2e` | Playwright + Vite + [`tauriMock.ts`](./tauriMock.ts) | CI（Ubuntu） |
| 真窗口 | `npm run test:e2e:desktop`（别名 `smoke:desktop`） | 真 Tauri 窗口 + IPC + 盘上 `git log` oracle | **本机**，默认不进 CI |

## Mock（`main-path.spec.ts`）

- 浏览器里跑前端，invoke 被 mock。
- 通过 `data-testid` 点击欢迎页 / stage / commit / 日志。
- 首次：`npx playwright install chromium`。

## 真窗口（desktop smoke）

- [`scripts/desktop-smoke.sh`](../scripts/desktop-smoke.sh) 建临时仓，设 `GITNEST_DESKTOP_SMOKE`，启动 `tauri dev`。
- 欢迎页检测到配置后走 [`src/lib/desktopSmoke.ts`](../src/lib/desktopSmoke.ts)：`open` → `edit` → `stage` → `commit` → `log`。
- 脚本在报告 `ok` 后再用 `git log -1` 核对 commit subject（磁盘 oracle）。
- 报告：`$TMPDIR/gitnest-desktop-smoke.json`。

## 不做

- Playwright / WebDriver 操控真 Tauri 窗口。
- 把 `test:e2e:desktop` 挂进 CI（跨平台桌面启动成本高、噪声大）。
