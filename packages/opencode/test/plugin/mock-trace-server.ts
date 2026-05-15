/**
 * Mock Trace Server - 模拟华为 Trace 上报接口
 *
 * 用法: bun run script/mock-trace-server.ts
 * 端口: 3001 (可通过 PORT 环境变量修改)
 *
 * 接口:
 *   POST /codeGenie/cli/trace/upload  - 接收上报数据
 *   GET  /                            - 网页表格展示
 *   GET  /api/events                  - JSON 事件列表
 *   DELETE /api/events                - 清空事件
 */

const PORT = parseInt(process.env.PORT || "3001", 10)

interface AnalyticsEvent {
  sourceType: string
  sourceVersion: string
  modelId: string
  uid: string
  userid: string
  sessionid: string
  query: string
  answer: string
  inputTokenCount: number
  outputTokenCount: number
  projectName: string
  modifiedFileList: Array<{ fileName: string; additions: number; deletions: number }>
  operations: {
    builtinTools: Array<{ name: string; count: number }>
    mcpTools: Array<{ name: string; count: number }>
    skillTools: Array<{ name: string; count: number }>
  }
  toolExecutions: Array<{
    toolName: string
    duration: number
    isSuccess: boolean
    timestamp: number
  }>
  isSuccess: boolean
  totalElapsed: number
  firstResultElapsed: number
  os_name: string
  os_version: string
}

interface StoredEvent {
  receivedAt: string
  event: AnalyticsEvent
  rawDetail: string
}

const events: StoredEvent[] = []

// ---- HTTP Server ----
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      })
    }

    // POST /codeGenie/cli/trace/upload
    if (req.method === "POST" && url.pathname === "/codeGenie/cli/trace/upload") {
      return handleUpload(req)
    }

    // GET /api/events
    if (req.method === "GET" && url.pathname === "/api/events") {
      return jsonResponse(events)
    }

    // DELETE /api/events
    if (req.method === "DELETE" && url.pathname === "/api/events") {
      const count = events.length
      events.length = 0
      return jsonResponse({ cleared: count })
    }

    // GET / - web page
    if (req.method === "GET" && url.pathname === "/") {
      return htmlResponse(renderPage())
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`Mock Trace Server running at http://localhost:${PORT}`)
console.log(`  POST http://localhost:${PORT}/codeGenie/cli/trace/upload`)
console.log(`  View  http://localhost:${PORT}/`)

// ---- Handlers ----

async function handleUpload(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const payload = Array.isArray(body) ? body : [body]

    for (const item of payload) {
      const detailStr = typeof item.detail === "string" ? item.detail : JSON.stringify(item.detail)
      let event: AnalyticsEvent
      try {
        event = JSON.parse(detailStr)
      } catch {
        event = detailStr as unknown as AnalyticsEvent
      }

      events.push({
        receivedAt: new Date().toISOString(),
        event,
        rawDetail: detailStr,
      })

      console.log(
        `[${new Date().toISOString()}] Event received: model=${event.modelId}, session=${event.sessionid?.slice(0, 8)}..., tokens=${event.inputTokenCount}/${event.outputTokenCount}`,
      )
    }

    return jsonResponse({ code: 0, message: "success", count: payload.length })
  } catch (err) {
    console.error("Failed to parse upload body:", err)
    return jsonResponse({ code: -1, message: "invalid body" }, 400)
  }
}

// ---- Response helpers ----

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  })
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
  })
}

// ---- HTML Page ----

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function renderPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevEco Code Analytics - Mock Trace Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
    h1 { color: #60a5fa; margin-bottom: 8px; font-size: 20px; }
    .stats { color: #888; margin-bottom: 16px; font-size: 13px; }
    .stats span { color: #60a5fa; }
    .actions { margin-bottom: 16px; }
    .actions button { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 8px; }
    .actions button:hover { background: #334155; color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { background: #1e293b; color: #94a3b8; padding: 8px 10px; text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 1; border-bottom: 2px solid #334155; }
    tbody tr { border-bottom: 1px solid #1e293b; }
    tbody tr:hover { background: #111827; }
    tbody td { padding: 6px 10px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
    .tag-success { background: #064e3b; color: #6ee7b7; }
    .tag-fail { background: #7f1d1d; color: #fca5a5; }
    .mono { font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }
    .empty { text-align: center; padding: 60px 20px; color: #555; font-size: 15px; }
    .detail-row td { padding: 0 !important; }
    .detail-content { background: #0f172a; padding: 12px 16px; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; color: #94a3b8; }
    .token-bar { display: inline-block; height: 4px; border-radius: 2px; vertical-align: middle; }
    .token-in { background: #60a5fa; }
    .token-out { background: #f472b6; }
  </style>
</head>
<body>
  <h1>DevEco Code Analytics</h1>
  <div class="stats">
    Total events: <span id="total">0</span> &nbsp;|&nbsp;
    Last received: <span id="last-time">-</span> &nbsp;|&nbsp;
    Auto-refresh: <span id="refresh-status">5s</span>
  </div>
  <div class="actions">
    <button onclick="refresh()">Refresh</button>
    <button onclick="clearAll()">Clear All</button>
    <button onclick="toggleAutoRefresh()">Pause Auto-Refresh</button>
  </div>
  <div id="table-container">
    <div class="empty">No events received yet.<br><br>
      POST to <code style="color:#60a5fa">http://localhost:${PORT}/codeGenie/cli/trace/upload</code>
    </div>
  </div>

  <script>
    let autoRefresh = true;
    let refreshTimer = null;

    async function refresh() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        renderTable(data);
        document.getElementById('total').textContent = data.length;
        document.getElementById('last-time').textContent =
          data.length > 0 ? data[data.length - 1].receivedAt : '-';
      } catch (e) {
        console.error('Refresh failed:', e);
      }
    }

    async function clearAll() {
      await fetch('/api/events', { method: 'DELETE' });
      refresh();
    }

    function toggleAutoRefresh() {
      autoRefresh = !autoRefresh;
      document.getElementById('refresh-status').textContent = autoRefresh ? '5s' : 'paused';
      document.querySelector('.actions button:nth-child(3)').textContent =
        autoRefresh ? 'Pause Auto-Refresh' : 'Resume Auto-Refresh';
      setupTimer();
    }

    function setupTimer() {
      if (refreshTimer) clearInterval(refreshTimer);
      if (autoRefresh) refreshTimer = setInterval(refresh, 5000);
    }

    function esc(s) {
      if (s == null) return '';
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function truncate(s, n) {
      if (!s) return '';
      return s.length > n ? s.slice(0, n) + '...' : s;
    }

    function toolCount(ops) {
      if (!ops) return '0';
      const builtin = (ops.builtinTools || []).reduce((s, t) => s + t.count, 0);
      const mcp = (ops.mcpTools || []).reduce((s, t) => s + t.count, 0);
      const skill = (ops.skillTools || []).reduce((s, t) => s + t.count, 0);
      const parts = [];
      if (builtin) parts.push('builtin:' + builtin);
      if (mcp) parts.push('mcp:' + mcp);
      if (skill) parts.push('skill:' + skill);
      return parts.length ? parts.join(' ') : '0';
    }

    function formatTime(ms) {
      if (ms == null) return '-';
      if (ms < 1000) return ms + 'ms';
      return (ms / 1000).toFixed(1) + 's';
    }

    function renderTable(events) {
      const container = document.getElementById('table-container');
      if (!events || events.length === 0) {
        container.innerHTML = '<div class="empty">No events received yet.<br><br>POST to <code style="color:#60a5fa">http://localhost:${PORT}/codeGenie/cli/trace/upload</code></div>';
        return;
      }

      let html = '<table><thead><tr>'
        + '<th>#</th><th>Time</th><th>Model</th><th>Session</th><th>User</th>'
        + '<th>Query</th><th>In Tokens</th><th>Out Tokens</th>'
        + '<th>Total</th><th>First Resp</th><th>Tools</th><th>Files</th><th>OK</th>'
        + '</tr></thead><tbody>';

      events.forEach((item, i) => {
        const e = item.event;
        const idx = events.length - i;
        const successTag = e.isSuccess
          ? '<span class="tag tag-success">OK</span>'
          : '<span class="tag tag-fail">FAIL</span>';
        const files = e.modifiedFileList ? e.modifiedFileList.length : 0;
        const maxBar = 500;

        html += '<tr style="cursor:pointer" onclick="toggleDetail(this)">'
          + '<td class="mono">' + idx + '</td>'
          + '<td class="mono">' + item.receivedAt.replace('T', ' ').slice(11, 19) + '</td>'
          + '<td>' + esc(e.modelId) + '</td>'
          + '<td class="mono" title="' + esc(e.sessionid) + '">' + esc((e.sessionid || '').slice(0, 8)) + '...</td>'
          + '<td>' + esc(e.userid) + '</td>'
          + '<td title="' + esc(e.query) + '">' + esc(truncate(e.query, 50)) + '</td>'
          + '<td class="mono">' + (e.inputTokenCount || 0) + '</td>'
          + '<td class="mono">' + (e.outputTokenCount || 0) + '</td>'
          + '<td class="mono">' + formatTime(e.totalElapsed) + '</td>'
          + '<td class="mono">' + formatTime(e.firstResultElapsed) + '</td>'
          + '<td class="mono">' + toolCount(e.operations) + '</td>'
          + '<td class="mono">' + files + '</td>'
          + '<td>' + successTag + '</td>'
          + '</tr>';

        // Detail row (hidden by default)
        html += '<tr class="detail-row" style="display:none"><td colspan="13">'
          + '<div class="detail-content">' + esc(item.rawDetail) + '</div>'
          + '</td></tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function toggleDetail(tr) {
      const detail = tr.nextElementSibling;
      if (detail && detail.classList.contains('detail-row')) {
        detail.style.display = detail.style.display === 'none' ? '' : 'none';
      }
    }

    refresh();
    setupTimer();
  </script>
</body>
</html>`
}
