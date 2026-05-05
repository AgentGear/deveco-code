# 发布工作流

> 单向演进，双向合入。代码从开发分支单向流向发布；Bug 修复从发布分支同步回开发分支。
>
> 开发流程见 [DEV-WORKFLOW.md](./DEV-WORKFLOW.md)。

## 分支模型

| 分支 | 角色 | 生命周期 | 说明 |
|------|------|----------|------|
| `master` | 生产环境 | 永久 | 合并建议使用 `--no-ff` 保留版本边界，禁止直接推送。历史 Tag 可精确复现任意版本 |
| `release/v*` | 发布快照 | 临时 | 从 `upstream-tracking-develop` 检出，用于预发布测试和 Bug 修复。发布后删除 |
| `hotfix/*` | 紧急修复 | 临时 | 从 `master` 的 Tag 检出，修复后合并至 `master` 并同步回 `upstream-tracking-develop` |

## 标准发布

**触发条件**：维护者根据功能完成度人工判定。

```text
upstream-tracking-develop ──检出──▶ release/v1.0
                                      │
                               回归测试 & Bug 修复
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
         发现 Bug：合并回 develop              测试通过：--no-ff 合并至 master
                    │                                   │
                    ▼                                   ▼
         upstream-tracking-develop                 打 Tag v1.0.0
                                                         │
                                                      删除 release
```

1. 从 `upstream-tracking-develop` 检出 `release/v*` 分支
2. **此时 `upstream-tracking-develop` 立即开放**，允许合入下一版本特性
3. 回归测试在 `release/v*` 上进行
4. 测试通过后，`release/v*` `--no-ff` 合并至 `master`，打 Tag，删除 `release/v*`

> **修复同步**：`release/v*` 上的 Bug 修复必须立即合并回 `upstream-tracking-develop`，防止重现。

## 紧急修复 Hotfix

```text
master (v1.0.0) ──检出──▶ hotfix/xxx
                              │
                         修复 & 测试
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
              master (--no-ff)     upstream-tracking-develop
              打 Tag v1.0.1        (普通 merge)
```

1. 从 `master` 当前 Tag 检出 `hotfix/*` 分支
2. 修复后 `--no-ff` 合并至 `master`，打补丁 Tag（如 `v1.0.1`）
3. **立即将 `hotfix/*` 普通 merge 回 `upstream-tracking-develop`**
4. 删除 `hotfix/*` 分支

> `upstream-tracking-develop` 必须始终包含所有已发布到 `master` 的代码。

## Tag 规范

版本号由维护者人工确定，格式遵循 [Semantic Versioning](https://semver.org/)：

```text
v{MAJOR}.{MINOR}.{PATCH}
```

- **MAJOR**：不兼容 API 变更
- **MINOR**：向下兼容功能新增
- **PATCH**：向下兼容 Bug 修复

示例：`v1.0.0`、`v1.0.1`（hotfix）、`v1.1.0`

## Master 演进规则

`master` 永远向前演进，**禁止覆盖**：

- 通过 `merge` 更新，禁止 `reset` / `force-push`
- 每次 `--no-ff` 合并产生清晰版本节点
- 历史 Tag 可精确复现：`git checkout v1.0.0`

```text
v1.0.0 ──▶ v1.0.1 ──▶ v1.1.0 ──▶ v1.2.0 ──▶ ...
```
