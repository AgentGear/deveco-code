# Upstream Sync Lessons

> 每次同步遇到的新坑。定期审查后抽象到 SKILL.md，已落地的条目删除。

<!-- 模板：
### v1.14.xx -> v1.14.yy — <一句话标题>

<现象和解决，2-3 行>
-->

### v1.14.51 -> v1.15.0 — TUI tips branding replacement

`packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` 中的 `TIPS` 数组包含用户可见的 `opencode` CLI 命令引用和 `OpenCode` 字符串。每次同步后需替换：`opencode <command>` → `deveco <command>`，`OpenCode` → `DevEco Code`。保留不变：`opencode.ai` URL、`/opencode` `/oc` GitHub bot 命令、`ghcr.io/anomalyco/opencode` Docker 镜像、import 路径、命令 ID（如 `opencode.status`）。
