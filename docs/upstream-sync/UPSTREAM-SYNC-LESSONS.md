# Upstream Sync Lessons Learned

> 同步规则和流程见 [UPSTREAM-SYNC-GUIDE.md](./UPSTREAM-SYNC-GUIDE.md)
> 同步历史记录见 [UPSTREAM-SYNC-CHANGELOG.md](./UPSTREAM-SYNC-CHANGELOG.md)

本文档记录上游同步过程中积累的经验、反复出现的问题和隐蔽陷阱，供后续同步参考。

---

## v1.14.27 → v1.14.28

### installation/index.ts 中 NpmConfig 导入变成死代码

上游 v1.14.28 重构了 npm 配置处理（新增 `packages/core/src/npm-config.ts`），在 `installation/index.ts` 中引入 `NpmConfig` 用于 HTTP 注册表查询。CodeGenie 保留 `viewVersion`（子进程方式）时，`NpmConfig` 导入变成未使用。冲突解决后需检查是否有因冲突处理导致的新增但未使用的导入。

**教训：保留本地方案时，上游新增的仅服务于被拒绝方案的导入可能被 auto-merge 合入，需逐一检查并清理。**

### 测试文件需与源码方案保持一致

上游将 npm/bun/pnpm 版本查询从 subprocess 改为 HTTP registry，同步修改了测试。auto-merge 合入了上游的 HTTP registry 测试，但我们的源码仍用 `viewVersion`（subprocess），导致测试与源码不匹配。此外，原测试中 `expect(calls).toContain(url)` 的断言对 `string[][]` 类型的 calls 数组无效。

**教训：源码冲突保留本地方案时，对应的测试文件也需同步检查。auto-merge 合入的测试可能引用了被拒绝方案的 API，需要重写。**

## v1.14.24 → v1.14.25

### httpapi/server.ts 认证代码已被上游提取到独立文件

上游 v1.14.25 将 HTTP API 认证逻辑从 `server.ts` 提取到独立文件 `auth.ts`，功能更完整（支持 basic + authToken 双模式）。本地 `server.ts` 中的旧内联认证代码（仅 basic、normalize hack）已完全冗余，冲突时应直接接受上游版本移除。但需同步修正 `auth.ts` 中上游的 `Flag.OPENCODE_SERVER_PASSWORD`/`OPENCODE_SERVER_USERNAME` 为 `CODEGENIE_*`。

**教训：遇到本地自有特性代码与上游同功能代码冲突时，先检查上游是否已做了更好的实现。如果上游版本功能覆盖更全，应接受上游再补品牌标识，而非机械保留本地版本。**

### ripgrep.ts 冲突中的误导性导入

`ripgrep.ts` 冲突区块包含 `import { fileURLToPath } from "url"` 和 `import z from "zod"` 两行。直观判断是 zod→Effect 迁移残留，但实际上 `fileURLToPath` 是 CodeGenie 自有的 vendor/dev-mode 二进制查找逻辑所使用的导入。接受上游（删除这两行）会导致 CodeGenie 的 ripgrep 二进制查找路径丢失。

**教训：删除看似无用的导入前，必须搜索该符号在文件中的所有使用。`fileURLToPath` 在 zod 迁移上下文中容易被误判为残留，但它实际服务于本地的产品化改造（vendor 目录查找、.build-cache 开发模式查找）。**

### lsp/server.ts 自动合并后需验证品牌标识

`lsp/server.ts` 自动合并成功（无冲突标记），但上游新增的 `installRoslynLanguageServer()` 等提取函数中使用了 `Flag.OPENCODE_DISABLE_LSP_DOWNLOAD`。Git 将这些新增函数视为"来自上游的新代码"直接合入，不会触发冲突。必须全局搜索确认所有 `OPENCODE_` 已改为 `CODEGENIE_`。

### 再次出现 workspace 依赖名称问题

`packages/web/package.json` 的 `"opencode": "workspace:*"` 在每次版本号冲突被解决时都可能被覆盖回上游值。这是**反复出现的问题**，同步后务必检查。

---

## v1.14.20 → v1.14.21

### package.json 冲突套路

所有 package.json 冲突都是纯版本号差异（`1.14.20` → `1.14.21`），唯独 `packages/opencode/package.json` 额外包含 `name` 字段冲突（`codegenie` vs `opencode`）。解决方式：接受上游版本号，但把 name 保留为 `codegenie`。

### bun.lock 直接接受上游即可

bun.lock 冲突块多但都是依赖锁文件，直接 `git checkout --theirs` 接受上游版本，然后 `bun install` 重新生成即可。

### Flag 命名自动合并陷阱

上游新增或修改了 `Flag.OPENCODE_*` 时，git auto-merge 会直接采用上游文本，导致本地已重命名的 `Flag.CODEGENIE_*` 被覆盖回 `OPENCODE`。本次在 `upgrade.ts` 和 `server.ts` 中都遇到了这个问题。**解决后务必全局搜索确认没有 `OPENCODE_` 残留。**

### upgrade.ts 中的重复检查

上游 v1.14.21 移除了 `upgrade.ts` 中一处重复的 autoupdate 禁用检查（原来有两个相同的 `if` 判断）。CodeGenie 之前两个位置都改成了 `CODEGENIE_DISABLE_AUTOUPDATE`，合并时只需保留第一个（行首那个），删除重复的那个。

### workspace 依赖引用名称未随品牌重命名同步

`packages/web/package.json` 中的 devDependency `"opencode": "workspace:*"` 引用的是 `packages/opencode/package.json` 的 `name` 字段。品牌重命名将 name 从 `opencode` 改为 `codegenie` 后，其他包中通过 `workspace:*` 引用该包的地方也需要同步更新依赖名。bun workspace 依赖是通过 package `name` 字段解析的，name 变了但引用没改，会导致 `bun install` 报 `Workspace dependency "opencode" not found` 错误。

**同步后务必搜索所有 `package.json` 中是否存在 `"opencode": "workspace:*"` 残留引用，以及是否有其他包的 `name` 已重命名但 workspace 引用未同步的情况。**

### server.ts 的 csharp-ls → roslyn-language-server 迁移

上游将 C# LSP 从 `csharp-ls` 替换为 `roslyn-language-server`，涉及 `dotnet tool install` 命令和二进制路径变更。同时 `Npm.which("pyright")` 新增了第二个参数 `"pyright-langserver"`。这些都是上游功能变更，应直接接受，仅保留 `CODEGENIE_DISABLE_LSP_DOWNLOAD` flag。

---
