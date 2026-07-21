# 发布文档

## 发布目标

GitNest 使用 Tauri 2 打包桌面应用。macOS 下主要产物：

- `target/release/bundle/macos/GitNest.app`
- `target/release/bundle/dmg/GitNest_0.1.0_aarch64.dmg`
- 如果开启 updater，还会生成 updater 相关压缩包和签名信息。

当前配置中 updater 已关闭，因此默认发布目标是 `.app` 和 `.dmg`。

## 发布前检查

发布前建议检查：

- `package.json` 的版本。
- `src-tauri/tauri.conf.json` 的 `version`、`productName`、`identifier`。
- 图标文件是否齐全：`src-tauri/icons`。
- updater 是否需要开启。
- 是否包含不应发布的本地配置、密钥或调试文件。

当前版本来源：

- npm 包版本：`package.json` 的 `version`
- Tauri 应用版本：`src-tauri/tauri.conf.json` 的 `version`
- Cargo workspace 版本：`Cargo.toml` 的 `workspace.package.version`

建议发版时保持三处版本一致。

## 构建命令

在仓库根目录执行：

```bash
npm run tauri build
```

Tauri 会根据 `src-tauri/tauri.conf.json` 先执行：

```bash
npm run build
```

随后编译 Rust 后端并生成桌面包。

## macOS 产物位置

Apple Silicon 构建完成后通常生成：

```text
target/release/bundle/macos/GitNest.app
target/release/bundle/dmg/GitNest_0.1.0_aarch64.dmg
```

如果看到 `.app` 和 `.dmg` 已生成，说明主应用包已经打包成功。

## 当前 updater 配置

`src-tauri/tauri.conf.json` 当前设置：

```json
{
  "bundle": {
    "createUpdaterArtifacts": false
  },
  "plugins": {
    "updater": {
      "active": false,
      "pubkey": ""
    }
  }
}
```

原因：

- Tauri updater 产物需要签名。
- 如果配置了 public key 或启用 updater artifact，但没有 `TAURI_SIGNING_PRIVATE_KEY`，构建末尾会报错。
- 当前没有有效 `pubkey`，自动更新功能也无法正常工作，因此默认关闭。

## 启用 updater 的流程

只有需要自动更新时才执行本节。

### 1. 生成签名密钥

```bash
npm run tauri signer generate -- -w ~/.tauri/gitnest.key
```

命令会生成：

- 私钥：`~/.tauri/gitnest.key`
- 公钥：输出到终端，也可能生成 `.pub` 文件

私钥不要提交到仓库。

### 2. 更新 Tauri 配置

把公钥填入 `src-tauri/tauri.conf.json`：

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "这里填 signer generate 输出的公钥"
    }
  }
}
```

### 3. 构建时设置私钥

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gitnest.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

如果生成私钥时设置了密码，把密码填入 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

### 4. 发布 latest.json

updater endpoint 当前配置为（`active: false`，默认不启用自动更新）：

```text
https://github.com/OldCoffee/GitNest/releases/latest/download/latest.json
```

应用标识符为 `io.github.oldcoffee.gitnest`。

发布自动更新时，需要把 Tauri 生成的更新元数据和更新包一起上传到 GitHub Release，并确保 endpoint 能访问到正确的 `latest.json`。

## 常见构建结果判断

### 只需要安装包

如果命令输出中已经有：

```text
Finished 2 bundles at:
  .../GitNest.app
  .../GitNest_0.1.0_aarch64.dmg
```

则 `.app` 和 `.dmg` 已生成。若随后 updater 签名失败，说明失败点在更新包签名，不是主应用打包。

### updater 签名失败

典型错误：

```text
A public key has been found, but no private key.
Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
```

处理方式二选一：

- 不发布自动更新：关闭 `createUpdaterArtifacts` 和 updater `active`。
- 发布自动更新：设置 `TAURI_SIGNING_PRIVATE_KEY` 并配置有效 `pubkey`。

## 发布检查清单

- 已运行 `npm run build`。
- 已运行 `npm run tauri build`。
- `.app` 能正常打开。
- `.dmg` 能正常安装。
- 打开应用后欢迎页正常显示。
- 能打开本地仓库。
- Git 状态、项目树、文件编辑、diff 正常。
- updater 若开启，签名密钥、公钥、latest.json 和下载地址均已验证。
- 发布说明记录版本、主要改动、已知问题。

## 不应提交的内容

- `target/`
- `dist/`
- `node_modules/`
- 私钥文件，例如 `*.key`
- 本地调试日志
- 用户真实 token 或凭据
