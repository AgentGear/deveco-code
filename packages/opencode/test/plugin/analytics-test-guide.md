# Analytics 打点本地测试指南

> 由于当前云端上报接口存在问题，需要使用本地 Mock Server 进行打点测试。

## 前置条件

- 已通过 CodeGenie OAuth 登录
- 已安装 Bun 运行时

## 临时修改清单

测试前需手动修改以下 2 处代码（测试完毕后还原）：

### 1. 放开模型限制

**文件**: `src/plugin/analytics/analytics-plugin.ts`

将 `chat.message` hook 中的 providerID 检查注释掉，使任意模型都上报：

```typescript
// 修改前（正式代码）
const providerID = input.model?.providerID
if (providerID !== "codegenie") {
  await writeLog(`Session skipped: provider is ${providerID ?? "unknown"}`)
  globalCollector.clear()
  return
}

// 修改后（测试用）
// const providerID = input.model?.providerID
// if (providerID !== "codegenie") {
//   await writeLog(`Session skipped: provider is ${providerID ?? "unknown"}`)
//   globalCollector.clear()
//   return
// }
```

### 2. 上报地址指向本地 Mock Server

**文件**: `src/plugin/analytics/types.ts`

将 `DEFAULT_CONFIG.endpoint` 改为本地地址：

```typescript
// 修改前（正式代码）
endpoint: "https://cn.devecostudio.huawei.com/codeGenie/cli/trace/upload",

// 修改后（测试用）
endpoint: "http://localhost:3001/codeGenie/cli/trace/upload",
```

## 测试步骤

### Step 1: 启动 Mock Server

```bash
bun run packages/opencode/test/plugin/mock-trace-server.ts
```

终端输出：

```
Mock Trace Server running at http://localhost:3001
  POST http://localhost:3001/codeGenie/cli/trace/upload
  View  http://localhost:3001/
```

### Step 2: 打开浏览器

访问 http://localhost:3001 ，应看到空的事件表格页面。

### Step 3: 启动 CodeGenie CLI

```bash
# 在另一个终端
bun run dev
```

### Step 4: 进行对话测试

1. 确保已登录 CodeGenie OAuth（使用任意模型均可，因已放开限制）
2. 发送一条消息，等待 AI 回复完成
3. 可触发工具调用（如让 AI 编辑文件）以验证工具数据采集
4. 等待会话空闲（约 10 秒无交互）

### Step 5: 查看结果

- 浏览器页面每 5 秒自动刷新，应出现新的事件行
- 点击表格行可展开查看完整 JSON 数据
- 验证以下字段正确：
  - `modelId`: 使用的模型 ID
  - `query`: 用户输入
  - `inputTokenCount` / `outputTokenCount`: Token 数
  - `totalElapsed` / `firstResultElapsed`: 耗时
  - `modifiedFileList`: 编辑的文件列表
  - `toolExecutions`: 工具调用记录

## 测试完毕后还原

将上述两处修改恢复为正式代码，不要提交测试修改到代码仓库。

## Mock Server 接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/codeGenie/cli/trace/upload` | 接收上报数据 |
| GET | `/` | 网页表格展示 |
| GET | `/api/events` | JSON 事件列表 |
| DELETE | `/api/events` | 清空事件 |
