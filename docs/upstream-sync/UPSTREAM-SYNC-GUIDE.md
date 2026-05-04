# Upstream Sync Guide

> 本项目基于 [OpenCode](https://github.com/anomalyco/opencode) fork。
> 每次同步上游版本时，必须遵循本文档的流程和冲突解决原则。

## 同步策略

- 上游仓库 `opencode` → `git@github.com:anomalyco/opencode.git`
- 从上游稳定的 **release tag** 同步（如 `v1.14.21`），不从分支同步
- **保留上游原始提交历史，禁止 `--squash`**（会丢失上游提交节点，无法回溯）

## 同步流程

### Step 1: 准备

1. 确保工作区干净：`git status`
2. fetch 上游目标版本：`git fetch opencode <tag>`
3. 查看变更范围：`git log --oneline <old-tag>..<new-tag>`

### Step 2: 合并前分析（必须执行，等待用户确认后继续）

> 如运行环境支持 subagent/子代理调用，可委派子代理自动执行以下步骤。

执行以下分析，将完整报告呈现给用户：

1. `git diff <old-tag>..<new-tag> --stat` — 查看变更文件
2. `git merge --no-commit --no-ff <new-tag>` — 模拟合并（仅计算，不提交）
3. `git diff --name-only --diff-filter=U` — 列出冲突文件
4. 逐个冲突文件：读取内容 → 判断类型（版本号/品牌名/功能逻辑/新增配置）→ 是否涉及 CodeGenie 自有特性
5. **查阅特性文档**：对涉及 CodeGenie 自有特性的冲突，查阅 [FEATURES-INDEX.md](../../specs/FEATURES-INDEX.md) 定位相关特性，读取其需求分析、功能设计和源码变更记录，作为冲突解决的依据
6. `git merge --abort` — 撤销模拟合并
7. 输出报告：变更概要 / 冲突清单及建议 / 高风险项 / 总体评估

将完整报告展示给用户，明确标注高风险冲突和建议处理方式。**等待用户确认后再继续。**

### Step 3: 执行合并

1. `git merge --no-ff <tag> --no-edit`
2. 按分析报告逐个解决冲突（遵循下方原则；涉及自有特性时综合代码与特性文档的要求进行判断）
3. 冲突解决后执行 `bun install` 更新锁文件
4. 在 [UPSTREAM-SYNC-CHANGELOG.md](./UPSTREAM-SYNC-CHANGELOG.md) 添加同步记录

### Step 4: 验证

1. `bun run build` — 构建通过
2. `bun run typecheck` — 类型无误
3. `bun run dev` — TUI 正常启动，显示 CodeGenie 界面
4. `grep -r "OPENCODE_" packages/ --include="*.ts"` — 无新增不应存在的上游品牌残留
5. 功能回归测试（如适用）

## 冲突解决原则

按优先级从高到低：

1. **CodeGenie 自有特性**（品牌标识 `CODEGENIE_*`/`CodeGenie`、HarmonyOS、自定义 flag 等）→ **始终保留本地**
2. **上游功能变更**（bug 修复、功能增强、依赖升级）→ **接受上游**
3. **配置和构建脚本** → 以本地为准，合并上游新增项；若与原则 1 冲突则遵循原则 1
4. **辅助判断**：冲突时查阅 `specs/` 目录下的特性文档（需求分析、功能设计、源码变更记录）以明确自有特性的具体要求，并参考 [UPSTREAM-SYNC-LESSONS.md](./UPSTREAM-SYNC-LESSONS.md) 中的历史经验

## 相关文档

- 同步记录 → [UPSTREAM-SYNC-CHANGELOG.md](./UPSTREAM-SYNC-CHANGELOG.md)
- 经验总结 → [UPSTREAM-SYNC-LESSONS.md](./UPSTREAM-SYNC-LESSONS.md)
