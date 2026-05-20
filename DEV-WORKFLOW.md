# Git 开发工作流

> 代码从功能分支单向流向开发分支，保持提交历史线性整洁。

## 分支模型

| 分支 | 角色 | 生命周期 | 说明 |
|------|------|----------|------|
| `master` | 生产环境 | 永久 | 仅通过发布流程合入，禁止直接推送。详见 [RELEASE-WORKFLOW.md](./RELEASE-WORKFLOW.md) |
| `develop` | 主开发 | 永久 | 新特性合入目标，上游同步在此进行 |
| `<type>/<short-description>` | 功能 | 临时 | 从 `develop` 检出，PR 合回。分支命名格式见下方 |

分支命名格式：`<type>/<short-description>`

- **type**: `feat` | `fix` | `chore` | `docs` | `refactor` | `test`（与 Commit 类型一致）
- **short-description**: 小写英文，短横线分隔，2-5 个词

示例：`feat/huawei-auth`、`fix/startup-crash`、`chore/upgrade-deps`

## 日常开发

```text
<type>/<short-description> ──PR──▶ develop
```

1. 从 `develop` 创建功能分支
2. 开发过程中定期同步上游：`git pull --rebase origin develop`
3. 开发完成提交 PR，目标 `develop`
4. 通过 CI 和 Code Review 后合入

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

| 类型 | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `chore` | 构建、依赖、配置 |
| `refactor` | 重构（不改变行为） |
| `test` | 测试相关 |

标题示例：

```text
feat(opencode): add dark mode
fix(app): crash on startup
fix: crash on startup
```

正文示例（按修改点逐条列出）：

```text
feat(opencode): add user profile page

1. add ProfileView component
2. add /profile route
3. integrate user info API

Signed-off-by: YourName <your.email@example.com>
```

提交内容规范：

1. **标题**：`<type>(<scope>): <描述>`，scope 为 `packages/` 下的目录名（如 `opencode`、`app`、`desktop`），跨包变更省略 scope
2. **正文**：按修改点逐条列出，每条一个独立的、可理解的变更单元
3. **粒度**：每个 commit 聚焦一个逻辑变更，避免混合不相关的修改
4. **语言**：中英文均可，保持同一 commit 内一致

## PR 检查清单

提交 PR 前确认以下事项：

- [ ] 代码通过类型检查（根目录运行 `bun turbo typecheck`，或从包目录运行 `bun typecheck`）
- [ ] 如有代码变更，读取 [FEATURES-INDEX.md](./specs/FEATURES-INDEX.md) 的"文档同步规则"段落并执行；纯文档变更跳过
- [ ] Commit 符合 Conventional Commits 规范

## 代码拉取

```bash
git pull --rebase
# 或设置默认
git config pull.rebase true
```

避免无意义的 merge commit。
