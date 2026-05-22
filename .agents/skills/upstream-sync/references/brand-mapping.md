# Brand Identifier Mapping

上游 OpenCode → DevEco Code 品牌重命名的完整映射。同步时按此表检查和恢复品牌标识。

## 已完成的重命名（当前代码状态）

### 核心路径与配置

| 上游 | 本地 | 文件 | 备注 |
|------|------|------|------|
| `const app = "opencode"` | `const app = "deveco"` | `packages/core/src/global.ts:9` | XDG 基础目录名 |
| `"opencode.db"` | `"deveco.db"` | `packages/opencode/src/storage/db.ts:34` | SQLite 数据库文件名 |
| `` `opencode-${channel}.db` `` | `` `deveco-${channel}.db` `` | `packages/opencode/src/storage/db.ts:36` | 渠道数据库文件名 |
| `"/Library/Application Support/opencode"` | `"/Library/Application Support/deveco"` | `packages/opencode/src/config/managed.ts:27` | macOS 托管配置目录 |
| `path.join(..., "opencode")` | `path.join(..., "deveco")` | `packages/opencode/src/config/managed.ts:29` | Windows 托管配置目录 |
| `"/etc/opencode"` | `"/etc/deveco"` | `packages/opencode/src/config/managed.ts:31` | Linux 托管配置目录 |
| `"ai.opencode.managed"` | `"ai.deveco.managed"` | `packages/opencode/src/config/managed.ts:12` | macOS MDM plist 域名 |
| `"/.opencode/agent/"` 等 | 已移除 | `packages/opencode/src/config/agent.ts:119` | 只保留 `/.deveco/` 模式 |
| `"/.opencode/command/"` 等 | 已移除 | `packages/opencode/src/config/command.ts:39` | 只保留 `/.deveco/` 模式 |

### 包名与二进制

| 上游 | 本地 | 文件 | 备注 |
|------|------|------|------|
| `"name": "opencode"` | `"name": "deveco"` | `packages/opencode/package.json` | 包名 |
| `"opencode": "./bin/opencode"` | `"deveco": "./bin/deveco"` | `packages/opencode/package.json` | bin 字段 |
| `"opencode": "workspace:*"` | `"deveco": "workspace:*"` | `packages/web/package.json` | workspace 依赖 |

### 环境变量前缀

| 上游 | 本地 | 范围 | 例外 |
|------|------|------|------|
| `OPENCODE_` | `DEVECO_` | 所有 `.ts`/`.tsx` 文件在 `packages/` 下 | `infra/enterprise.ts`（SST 部署配置如 `OPENCODE_STORAGE_ADAPTER`）和 `sdks/vscode/`（外部 API 标识如 `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`）不改 |

### LLM 推理调用 User-Agent

| 上游 | 本地 | 文件 | 备注 |
|------|------|------|------|
| `opencode/${version}` | `deveco/${version}` | `packages/opencode/src/session/llm.ts:352,357` | 所有 LLM 推理调用 |
| `opencode/${version}` | `deveco/${version}` | `packages/opencode/src/plugin/codex.ts:529,553,613` | ChatGPT/Codex/OpenAI |
| `opencode/.../${client}` | `deveco/.../${client}` | `packages/core/src/models-dev.ts:14` | models.dev API |

### TUI 与用户可见字符串

| 上游 | 本地 | 范围 | 备注 |
|------|------|------|------|
| `OpenCode` | `DevEco Code` | UI 字符串、标题、描述 | |
| `opencode <command>` | `deveco <command>` | TUI tips 中的命令引用 | `tips-view.tsx` |

### postinstall 脚本

| 上游 | 本地 | 文件 | 备注 |
|------|------|------|------|
| `` `opencode-${platform}-${arch}` `` | `` `@deveco/deveco-code-${platform}-${arch}` `` | `packages/opencode/script/postinstall.mjs` | 平台包名 |
| `opencode`/`opencode.exe` | `deveco`/`deveco.exe` | 同上 | 二进制文件名 |

## 不重命名的部分（保持 opencode）

这些是功能性标识符、外部 API 交互、或内部实现细节，改为 deveco 会导致功能异常或与上游不兼容。

### 第三方插件 User-Agent（认证依赖）

以下发给第三方 API 的 User-Agent **保持 `opencode/`**，因为部分服务通过此标识做认证校验和速率限制：

- `packages/opencode/src/installation/index.ts:54` — `userAgent()` 函数返回 `opencode/...`
- `packages/opencode/src/plugin/digitalocean.ts` — DigitalOcean API
- `packages/opencode/src/plugin/github-copilot/copilot.ts` — GitHub Copilot 认证
- `packages/opencode/src/tool/websearch.ts` — Parallel/Exa 搜索
- `packages/core/src/plugin/provider/gitlab.ts` — GitLab AI
- `packages/core/src/plugin/provider/cloudflare-*.ts` — Cloudflare Workers/Gateway
- `packages/opencode/src/tool/webfetch.ts:88` — fallback User-Agent

### Provider HTTP Headers（外部 API 校验）

以下 headers 发给第三方 AI 提供商，部分服务商通过 `X-Title` / `Referer` 做应用识别：

- `packages/core/src/plugin/provider/openrouter.ts` — `X-Title: "opencode"`, `Referer: opencode.ai`
- `packages/core/src/plugin/provider/nvidia.ts` — `X-Title: "opencode"`
- `packages/core/src/plugin/provider/vercel.ts` — `x-title: "opencode"`
- `packages/core/src/plugin/provider/kilo.ts` — `X-Title: "opencode"`
- `packages/core/src/plugin/provider/zenmux.ts` — `X-Title: "opencode"`
- `packages/core/src/plugin/provider/llmgateway.ts` — `X-Title: "opencode"`, `X-Source: "opencode"`
- `packages/core/src/plugin/provider/cerebras.ts` — `X-Cerebras-3rd-Party-Integration: "opencode"`
- `packages/opencode/src/provider/provider.ts` — 多个 provider 的 Referer/X-Title

### npm 包导入路径（构建依赖）

- `@opencode-ai/core` — 核心包名（workspace 内部引用）
- `@opencode-ai/plugin` — 上游插件包（npm registry 发布名）
- `@opencode-ai/*` — 所有上游工具库导入

### Provider ID 与服务标识

- `ProviderID.opencode` — 内置 provider 标识（`packages/core/src/provider.ts:10`）
- `"@opencode/"` Effect service tags — 92 个内部服务标识符（如 `@opencode/Session`, `@opencode/Storage`）
- `"~opencode/"` TypeId 符号 — 内部类型标识

### 外部 URL（无本地替代）

- `https://opencode.ai/config.json` — JSON schema URL
- `https://opencode.ai/docs/*` — 文档链接
- `https://app.opencode.ai` — Web UI upstream
- `/.well-known/opencode` — 远程配置发现端点

### 服务器协议标识

- `x-opencode-ticket` header — PTY 连接令牌
- `x-opencode-directory` / `x-opencode-workspace` headers — 服务器路由
- CORS origin 正则 `opencode.ai` — 匹配上游 Web UI
- `"opencode"` OpenAPI titles — API 分组标识

### 构建与分发（保留上游兼容）

- CLI 二进制构建路径 `dist/opencode-*/bin/opencode`
- Nix 包定义 `nix/opencode.nix`（`pname = "opencode"`）
- Docker 镜像引用 `ghcr.io/anomalyco/opencode`
- GitHub workflow `opencode.yml`

### 其他不改动项

- OAuth dummy key `"opencode-oauth-dummy-key"` — 内部标识
- Server auth 默认用户名 `"opencode"`（header fallback）— 低优先级，仅影响设置了密码的本地开发
- 遥测属性 key `"opencode.client"` 等 — 后端分析依赖
- macOS 桌面端 app IDs/names — 桌面端暂不涉及
- URL 协议方案 `opencode://` — 桌面端暂不涉及
- 测试文件中的 `"opencode"` — 功能性测试标识

## 同步验证命令

```bash
# 检查核心路径是否正确使用 deveco
grep -rn '"opencode\.db"\|`opencode-' packages/opencode/src/storage/db.ts
grep -rn 'opencode' packages/opencode/src/config/managed.ts | grep -v '@opencode-ai'

# 检查不应该存在的 opencode 引用（排除导入路径和已知例外）
grep -rn '"opencode"' packages/opencode/src/storage/ packages/opencode/src/config/ | grep -v '@opencode-ai\|//\|opencode.ai'
```
