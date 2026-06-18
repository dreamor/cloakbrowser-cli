# CloakBrowser CLI 安全审查报告

**项目**: `@dreamor/cloakbrowser-cli`  
**版本**: 0.4.1  
**审查日期**: 2026-06-17  
**审查范围**: 全量源代码（47 个 TypeScript 文件 + 1 个入口 JS + 2 个 CI/CD YAML）  
**审查人**: 安全审查 Agent  

---

## 一、项目概述

CloakBrowser CLI 是一个基于 TypeScript 的命令行工具，为 AI Agent 提供控制 CloakBrowser（隐身 Chromium 浏览器）的能力。架构为 **Daemon 模式**（Unix Socket JSON-RPC 通信）+ **One-Shot 模式**（单次启动-操作-关闭），支持页面导航、DOM 交互、Cookie 管理、JS 求值、截图/PDF、网络请求等全功能浏览器操作。

**技术栈**: TypeScript + Node.js ≥20 + Commander.js + Playwright-core + jsdom + Readability + Turndown  
**通信协议**: Unix Socket 上的 JSON Line RPC  
**依赖数量**: 5 个 runtime 依赖 + 2 个 peer 依赖  

---

## 二、审查结论

| 类别 | 数量 |
|------|------|
| 🔴 严重漏洞 (Critical) | 0 |
| 🟠 高危问题 (High) | 3 |
| 🟡 中危问题 (Medium) | 5 |
| 🔵 低危/建议 (Low/Info) | 6 |

**总体评估**: 代码质量较高，结构清晰，无明显恶意代码或后门。但存在一些需要关注的安全风险点，主要集中在 **任意代码执行**、**文件路径遍历** 和 **Unix Socket 权限控制** 方面。

---

## 三、详细发现

### 🟠 高危问题 (High)

#### H-1: `page.eval` / `page.eval_file` — 任意 JavaScript 代码执行

**文件**: `src/daemon/methods/eval.ts` (第 7-28 行)  
**描述**: `page.eval` 接受任意字符串表达式并在浏览器页面上下文中执行，`page.eval_file` 读取任意本地文件路径并将其内容注入浏览器执行。两者均无沙箱隔离、白名单过滤或审计日志。

```typescript
// eval.ts:12-13 — 直接将用户输入的表达式注入浏览器执行
const wrapped = looksLikeExpression(expr) ? `(() => (${expr}))()` : expr;
const v = await ref.page.evaluate(wrapped, params.arg);

// eval.ts:24 — 直接读取任意路径文件并执行
const code = readFileSync(path, 'utf8');
const v = await ref.page.evaluate(code, params.arg);
```

**风险**:  
- 若 Daemon 被非授权进程连接，可通过 RPC 在浏览器中执行任意 JS
- `page.eval_file` 可读取服务器上任意文件内容（路径遍历），包括 `/etc/passwd`、私钥等敏感文件
- 作为 CLI 工具这是设计目标功能，但需要确保 Socket 访问受控

**建议**:  
1. 对 `eval_file` 的 `path` 参数进行路径校验，限制在工作目录或白名单目录内
2. 在 Daemon 启动时记录审计日志（eval 调用记录）
3. 考虑提供 `--no-eval` 启动选项以禁用 eval 类方法

---

#### H-2: Unix Socket 无认证机制

**文件**: `src/daemon/server.ts` (第 33 行), `src/client.ts` (第 37 行)  
**描述**: Daemon 通过 Unix Socket 监听连接，任何能访问该 Socket 文件的本地进程都可发送 RPC 命令。没有任何身份验证、Token 校验或来源检查。

```typescript
// server.ts:33 — 无认证直接接受连接
const server = createServer((sock) => handleConnection(sock, registry));

// server.ts:37 — 监听在用户可控路径
server.listen(paths.sock, () => { ... });
```

**风险**:  
- 同机器上的其他用户/进程若能访问 `~/.cloak/daemon.sock`（默认 0755 权限），即可完全控制浏览器会话
- 可执行任意 JS、窃取 Cookie/Storage、截图等
- 尤其在多用户服务器或容器共享环境下风险较高

**建议**:  
1. Socket 文件创建后设置 `chmod 0600`，确保仅 owner 可访问
2. 引入简单的 Token 认证机制（如启动时生成随机 token，存入文件，客户端连接时验证）
3. 在 `paths.root` 目录上确保权限为 `0700`

---

#### H-3: 文件路径未校验 — 任意文件读写

**文件**: 多个位置  
**描述**: 多个命令接受文件路径参数但未做路径规范化或边界检查：

| 操作 | 文件 | 路径参数 | 风险 |
|------|------|----------|------|
| 读文件执行 | `eval.ts:24` | `path` | 可读取任意文件内容 |
| 写截图 | `output.ts:62` | `writeBinaryOut(buf, path)` | 可覆盖任意文件 |
| 写 PDF | `content.ts:75` | `path` | 可覆盖任意文件 |
| 写 Storage State | `session.ts:44` / `storage.ts:12` | `path` | 可覆盖任意文件 |
| 读 Cookies | `cookies.ts:28` | `file` | 可读取任意 JSON 文件 |

```typescript
// output.ts:62 — 直接使用用户传入的路径写文件
export function writeBinaryOut(buf: Buffer, path: string) {
  writeFileSync(path, buf);  // 无路径校验
  ...
}
```

**建议**:  
1. 对所有写操作的路径参数做 `path.resolve()` + 检查前缀是否在允许范围内
2. 至少禁止写入 `~/.ssh/`、`/etc/` 等敏感目录
3. 对符号链接进行 `realpath` 检查

---

### 🟡 中危问题 (Medium)

#### M-1: `oneShotScrape` 使用字符串拼接构造浏览器端 JS

**文件**: `src/one-shot.ts` (第 112-127 行)  
**描述**: 虽然使用了 `JSON.stringify` 进行参数转义，但通过字符串模板构造了完整的 JS 代码在浏览器中执行。这种模式虽然当前安全（JSON.stringify 会转义特殊字符），但本质上是一种代码注入模式，后续维护时容易引入问题。

```typescript
const extracted = await page.evaluate(
  `(() => {
    const sel = ${JSON.stringify(opts.selector)};
    const multi = ${JSON.stringify(Boolean(opts.multi))};
    const attr = ${JSON.stringify(opts.attr ?? null)};
    ...
  })()`
);
```

**风险**: 目前因 `JSON.stringify` 保护而安全，但如果未来某个参数绕过了 stringify，则可能导致浏览器端代码注入。

**建议**: 改为使用 Playwright 的参数化 evaluate API `page.evaluate(fn, args)`，将参数通过专用通道传递而非拼接字符串。

---

#### M-2: `page.scroll` 中 `to` 参数直接注入 `document.querySelector`

**文件**: `src/daemon/methods/interaction.ts` (第 124-128 行)  
**描述**: `scroll` 命令的 `to` 参数经过 `resolveUid` 处理后直接传入页面端 `document.querySelector`。虽然 `resolveUid` 对 `u\d+` 格式进行了转义，但其他任意字符串直接透传。

```typescript
// interaction.ts:125-128
await ref.page.evaluate(
  `(sel) => { const el = document.querySelector(sel); if (el) el.scrollIntoView(...); }`,
  to
);
```

**风险**: CSS selector 注入本身危害有限（querySelector 不执行 JS），但复杂的 selector 可能导致 DoS 或意外行为。

**建议**: 对非 uid 格式的 selector 进行基本的合法性校验。

---

#### M-3: `dialog.handle_next` 无超时机制

**文件**: `src/daemon/methods/dialog.ts` (第 19-34 行)  
**描述**: 该方法返回一个 Promise，等待下一个 dialog 事件。如果页面永远不触发 dialog，这个 Promise 将**永久挂起**，RPC 调用永不返回，客户端 30 秒超时后断开但服务端的 listener 泄漏。

```typescript
return await new Promise<...>((resolve) => {
  const handler = (...args: unknown[]): void => { ... };
  ref.page.on('dialog', handler);  // 永久监听，无超时清理
});
```

**风险**: 资源泄漏、内存泄漏，反复调用可能累积大量未释放的事件监听器。

**建议**: 添加超时机制，超时后自动 `off('dialog', handler)` 并 reject。

---

#### M-4: Daemon PID 文件竞态条件

**文件**: `src/daemon/server.ts` (第 21-28 行), `src/daemon/lifecycle.ts`  
**描述**: 服务器启动时先检查 Socket 文件是否存在再删除，但不验证是否真的是 stale socket。注释里写了要 "try to connect; if ECONNREFUSED, remove" 但代码实际上直接 `unlinkSync` 删除。

```typescript
// server.ts:21-28 — 注释说验证但实际直接删除
if (existsSync(paths.sock)) {
  // stale socket — verify by trying to connect; if ECONNREFUSED, remove
  try {
    unlinkSync(paths.sock);  // ← 直接删除，未按注释验证
  } catch { /* ignore */ }
}
```

**风险**: 如果有另一个正在运行的 Daemon，新实例会删除其 Socket 文件导致通信中断。

**建议**: 实现注释中描述的逻辑：先尝试连接，确认 ECONNREFUSED 后再删除。

---

#### M-5: `release.yml` 中 NPM Token 为空字符串

**文件**: `.github/workflows/release.yml` (第 55 行)  
**描述**: `NODE_AUTH_TOKEN` 被设置为空字符串而非引用 GitHub Secret。

```yaml
env:
  NODE_AUTH_TOKEN: ''  # 应为 ${{ secrets.NPM_TOKEN }}
```

**风险**: 发布永远失败（认证错误），非安全漏洞但影响发布流程。  
**建议**: 改为 `${{ secrets.NPM_TOKEN }}` 或从 GitHub environment 中注入。

---

### 🔵 低危/建议 (Low/Info)

#### L-1: `batch` 命令的限制可通过环境变量绕过

**文件**: `src/commands/batch.ts` (第 88-93 行)  
**描述**: `CLOAK_BATCH_MAX_BYTES` 和 `CLOAK_BATCH_MAX_LINES` 通过环境变量可设为任意大值，绕过默认的 1MB/200 行限制。

**建议**: 设置硬上限 (hardcoded cap)，如最大 50MB / 10000 行。

---

#### L-2: `WAIT_STABLE_SCRIPT` 使用全局 `window.__cloakStable`

**文件**: `src/daemon/methods/params.ts` (第 156-176 行)  
**描述**: 在页面 window 对象上设置了 `__cloakStable` 属性。恶意页面可检测此属性判断是否被自动化工具控制，或篡改其值干扰等待逻辑。

**建议**: 使用 Symbol 或更隐蔽的命名，或通过 Playwright 的 `addInitScript` 在独立上下文中执行。

---

#### L-3: `snapshot` 脚本通过 `data-cloak-uid` 属性暴露自动化指纹

**文件**: `src/daemon/methods/params.ts` (第 112-146 行)  
**描述**: Snapshot 功能在页面 DOM 中注入 `data-cloak-uid` 属性。反自动化检测系统可检测此属性判断页面正被工具控制。

**建议**: 在 snapshot 完成后清理注入的属性，或使用可配置的属性名。

---

#### L-4: 错误信息中可能泄露服务端路径/堆栈

**文件**: `src/errors.ts` (第 59 行)  
**描述**: `fromUnknown` 将原始错误的 `stack` 信息包含在 `details` 中返回给客户端。

```typescript
return new CloakError('INTERNAL_ERROR', msg, { stack: err.stack });
```

**建议**: 生产环境中不返回堆栈信息，或增加环境判断控制。

---

#### L-5: `bin/cloak.js` 入口暴露堆栈信息

**文件**: `bin/cloak.js` (第 9 行)  
**描述**: 启动失败时将完整的 `err.stack` 输出到 stderr JSON 中。

**建议**: 仅在 `DEBUG` 环境变量启用时输出堆栈。

---

#### L-6: `colorize` 函数的正则可能误匹配

**文件**: `src/output.ts` (第 27-30 行)  
**描述**: JSON 着色的正则表达式较为简单，遇到包含引号转义的 JSON 值时可能产生不正确的着色。非安全问题，但影响输出准确性。

**建议**: 使用 JSON AST 遍历替代正则替换实现着色。

---

## 四、代码质量正面评价

| 方面 | 评价 |
|------|------|
| **架构设计** | ✅ 清晰的分层架构（CLI → Client → Daemon → Methods），职责分离良好 |
| **错误处理** | ✅ 统一的 `CloakError` 体系，错误码分类明确，`fromUnknown` 做了类型映射 |
| **类型安全** | ✅ TypeScript 严格模式，peer deps 使用 `unknown` 避免编译时依赖 |
| **资源管理** | ✅ Registry 的 TTL 过期清理机制，信号处理优雅关闭 |
| **输入校验** | ✅ `reqStr`/`optStr`/`optNum` 统一的参数提取，`parseViewport`/`parseJsonArg` 等带校验的解析 |
| **CI/CD** | ✅ 有类型检查、构建验证、多版本单测、E2E 测试、console.log 检测、硬编码密钥检测 |
| **依赖管理** | ✅ 依赖精简，peer deps 设计合理，锁文件完整 |
| **无恶意代码** | ✅ 未发现后门、隐蔽数据外传、混淆代码或可疑网络请求 |

---

## 五、修复优先级建议

| 优先级 | 编号 | 修复建议 |
|--------|------|----------|
| P0 | H-2 | Unix Socket 设置 `0600` 权限 + `paths.root` 设置 `0700` |
| P1 | H-3 | `writeBinaryOut` 等路径写操作增加路径校验 |
| P1 | H-1 | `eval_file` 限制可读取目录范围 |
| P2 | M-4 | 修复 stale socket 检测逻辑，按注释先尝试连接 |
| P2 | M-3 | `dialog.handle_next` 添加超时清理 |
| P2 | M-5 | 修复 `release.yml` 中的 `NODE_AUTH_TOKEN` 配置 |
| P3 | M-1 | `oneShotScrape` 改用参数化 evaluate |
| P3 | L-1~L-6 | 低优先级逐步改进 |

---

## 六、总结

该项目代码整体质量 **较高**，架构清晰，无恶意代码或明显后门。主要安全风险集中在其 **设计目标本身**（控制浏览器执行任意操作）所带来的攻击面，核心问题在于 Daemon Unix Socket 缺乏认证保护和文件路径操作缺乏边界校验。建议优先修复 H-2（Socket 权限）和 H-3（路径校验），可显著降低在共享环境下的攻击风险。
