# CloakBrowser CLI — Agent Skill 化改造评审

> 评审视角：把 `cloak` CLI 封装成 agent 可调用的 skill（Claude Code skill / 工具）时，哪些点会让 agent 卡住、绕路、或灌爆 context。
>
> 评审时间：2026-06-16
> 评审版本：cloakbrowser-cli v0.2.2 / SKILL.md / src/cli.ts
> 关联记忆：`cloakbrowser-cli-bugs.md`（端到端测试发现的 5 个 bug）

---

## 总览

四档优先级：

| 档位 | 主题 | 影响 |
|---|---|---|
| **P0** | 阻塞 bug + 直觉违反 | agent 按 SKILL.md 跑三步就翻车 |
| **P1** | Agent ergonomics | 输出体积、daemon 生命周期、session 引用 |
| **P2** | Skill 元数据自描述 | 让 agent 不依赖 SKILL.md 漂移 |
| **P3** | 多 agent / 多项目稳定性 | 并发隔离、安全边界 |

推荐落地顺序：**P0 → P1（输出体积 + named sessions）→ P2（introspect + 结构化错误）**。
做完这三步，agent 几乎可以「读完 SKILL.md 即用」。

---

## P0 — agent 工作流当场就会断

### P0-1 未修复的 bug 仍躺在 memory 里

记忆 `cloakbrowser-cli-bugs.md` 列出 5 个 bug，下列至少 4 个直接影响 agent 路径：

| Bug | 现象 | agent 影响 |
|---|---|---|
| Bug 1 | `cloak a11y <sid>` → `Cannot read properties of undefined (reading 'snapshot')`（`page.accessibility` 在当前 Playwright 版本上不可用） | a11y 树是 agent 选择元素的主路径，崩溃即流程断 |
| Bug 2 | `cloak page new <sid>` → `Please use browser.newContext()` | 多页面流程不能用 |
| Bug 3 | 全局 `--out <path>` 在 daemon 路径不生效，截图仍返回 base64 | agent 期望「大输出落盘」语义失效，context 直接被打爆 |
| Bug 4 | `cloak fingerprint` 不是真子命令，输出顶层 help | SKILL.md 提到的命令实际不存在 |
| Bug 5 | `cloak test` 等待 `networkidle` 30s 超时 | 自检命令不能稳定通过，agent 无法用 doctor + test 做健康检查 |

**行动**：把这 5 条转成 GitHub Issue 并修复；CI 加 doc-as-test 防复发（见 P2-4）。

### P0-2 snapshot 给的是 uid，交互命令却只接受 selector

- `cloak snapshot` 返回 `{uid: "u7", role, name, ...}` 结构。
- `cloak click / fill / hover` 只接受 selector，agent 必须自己拼 `[data-cloak-uid="u7"]`。

多一步字符串拼接 = 多一类错误。

**行动**：交互命令检测 `^u\d+$` 形式的目标参数，自动转成 `[data-cloak-uid="$1"]`。

### P0-3 `--out` 全局 flag 与命令级 `--path` 语义混乱

`src/commands/content.ts:73,99` 等位置用了 `--path` 作为主 flag，全局 `--out` 只是 fallback；而 `content` / `text` / `html` / `markdown` 完全没读 `--out`。

**行动**：
- 统一：所有产生大输出的命令一律支持 `--out <path>`（全局）+ `--path <path>`（命令级覆盖）。
- 默认对超过阈值（例如 64KB）的输出走「写文件 + 返回 `{path, size, sha256}`」。

---

## P1 — Agent ergonomics

### P1-1 默认输出体积保护

`screenshot --full-page` 当前默认回 base64（`output.ts: maybeFileOrBase64`）。一张 1440 全长截图轻松上百 KB，直接灌进 agent context。

**行动**：
- 默认写临时文件 `os.tmpdir()/cloak-<sid>-<ts>.png`，只回 `{path, size, sha256}`。
- 需要 base64 时显式 `--inline` / `--base64`。
- 同样的策略套到 `content` / `html` / `markdown`，并增加 `--max-bytes <n>` 用于截断。

### P1-2 Daemon 隐式启动

当前第一条命令若是 `session new` 而 daemon 未起，会得到 `DAEMON_NOT_RUNNING`。agent 必须为「冷启动」单独写一段，是常见漏写点。

**行动**：
- 默认行为：若 `session new` 时发现 daemon 未起，自动 `daemon start`（输出一行 stderr 提示）。
- 或加 env：`CLOAK_AUTO_DAEMON=1`。
- 配套加 `daemon` 的 idle auto-shutdown（见 P3-2）。

### P1-3 Named sessions

`cloak session new --name=login`，所有后续命令既可用 `<sid>` 也可用 `--name login` 或 `@login`。
agent 在多步流程里不需要再 `jq -r '.data.session_id'`。

```bash
# 现状
SID=$(cloak session new --humanize | jq -r .data.session_id)
cloak goto "$SID" https://example.com

# 期望
cloak session new --name=login --humanize
cloak goto @login https://example.com
```

### P1-4 隐式 last-session

`cloak goto - <url>` / `cloak text -` 用 `-` 表示「上一个 session」。
对单 agent 单流程极顺手，省一个变量。

### P1-5 after-action 快照

所有交互命令支持 `--snapshot`，执行完顺带返回新的 a11y 快照：

```bash
cloak click @login u7 --snapshot
# → { ok:true, data:{ clicked:true, snapshot:[...] } }
```

省一次 round-trip，agent 立刻能看到点击后页面变化。

---

## P2 — Skill 元数据 / 自描述

### P2-1 机器可读命令清单

`cloak introspect` 或 `cloak help --json`，输出每条子命令的 args / options / 枚举值 / 默认值（commander 内部能直接拿到）。

```json
{
  "version": "0.2.2",
  "commands": [
    {
      "name": "goto",
      "args": [{ "name": "session_id", "required": true }, { "name": "url", "required": true }],
      "options": [
        { "name": "--wait-until", "enum": ["load","domcontentloaded","networkidle","commit"] },
        { "name": "--timeout", "type": "number" }
      ]
    }
  ]
}
```

agent 用它做 tool schema，永远跟二进制对齐，不靠 `SKILL.md` 漂移版本。

### P2-2 结构化错误

`src/errors.ts: fromUnknown` 把 Playwright 消息原样透传成 `INTERNAL_ERROR + stack`，agent 没有可恢复信息。

**行动**：在 `details` 里补：

| 字段 | 用途 |
|---|---|
| `hint` | 短句建议（"selector 没找到，试试 cloak snapshot 拿 uid"） |
| `recoverable: true/false` | agent 知不知道值得重试 |
| `selector_suggestions[]` | `SELECTOR_NOT_FOUND` 时取 snapshot top-N 相似 |
| `kind` | 区分 `nav-timeout` / `wait-timeout` / `network-timeout`（当前都映射成 `TIMEOUT`） |

### P2-3 SKILL.md：从「命令清单」改为「索引 + recipes」

当前 56 条 RPC + 各种子命令塞在一个 markdown 里，agent 读起来全是噪音。

**行动**：
- 主 `SKILL.md` 只保留：identity、安装、两种模式总览、recipe 索引、错误码概览。
- 详细命令清单 → `cloak introspect`（机器） + `docs/COMMANDS.md`（人）。
- 拆出 `docs/recipes/`：
  - `login-and-scrape.md`
  - `cookie-replay.md`
  - `multi-page-session.md`
  - `fingerprint-bypass.md`
  - `pdf-export.md`

### P2-4 SKILL.md 当 doc-test 跑（CI）

解析 markdown 里的 fenced ` ```bash ` block，提取所有 `cloak …` 调用，对每个跑 `--help` 校验子命令真的注册了。

防止 Bug 4 这种「文档里写了实际没注册」复发。

---

## P3 — 稳定性 / 多 agent 友好

### P3-1 per-cwd daemon namespace

当前 daemon 是全局单例 socket。两个 agent 在两个项目并行跑会串扰 session_id。

**行动**：socket 路径按 `cwd hash` 命名，或显式 `--namespace <name>`。

### P3-2 Session TTL + daemon idle shutdown

agent 经常忘记 `session close`，资源泄漏。

**行动**：
- `cloak session new --ttl 600` —— 600s 无操作自动关闭。
- daemon 空转 N 分钟后自停（可由 `CLOAK_DAEMON_IDLE_TIMEOUT` 配置）。

### P3-3 `--allow-eval` 显式开关

`eval` / `eval-file` 默认禁掉，防止 agent 被 prompt-injection 利用执行任意 JS。
显式 `CLOAK_ALLOW_EVAL=1` 或 `--allow-eval` 才放行。

### P3-4 Proxy 凭证不进 shell history / ps

`--proxy http://u:p@host` 当前会进 shell history 和进程列表。

**行动**：提供 `--proxy-file <path>` 或 `CLOAK_PROXY` env 变量。

### P3-5 安装收敛

当前要：
```bash
npm i -g @dreamor/cloakbrowser-cli cloakbrowser playwright-core
cloak binary install
```

三个全局包 + 一个 binary 步骤，agent 容易漏。

**行动**：
- 把 `cloakbrowser` / `playwright-core` 锁成 `dependencies`，agent 一条命令装完。
- `cloak doctor` 在缺依赖时输出**完整可粘贴**的修复指令而不只是 missing 列表。

---

## 落地清单（建议 Issue 拆分）

### 已完成（2026-06-17）
- [x] F1: 交互命令自动识别 `u\d+` uid 形式
- [x] F2: One-shot 模式补齐 `--out`
- [x] F3: 文本命令补齐 `--out`
- [x] F4: `--version` 从 `package.json` 读取
- [x] F5: `oneShotFetch` re-throw 修复
- [x] F12: optStr/reqStr 去重

### 待完成
- [ ] 大输出默认落盘 + `--inline` opt-in
- [ ] 自动启动 daemon + idle shutdown
- [ ] Named sessions `--name=` / `@name` / `-` last-session
- [ ] 交互命令 `--snapshot` 后置快照
- [ ] `cloak introspect` 输出 JSON Schema
- [ ] 结构化错误（hint / kind / recoverable / suggestions）
- [ ] SKILL.md 拆分 + recipes/ 目录
- [ ] CI doc-as-test
- [ ] per-cwd daemon namespace
- [ ] `--allow-eval` / `--proxy-file`
- [ ] 依赖收敛 + doctor 输出可粘贴修复指令

---

## 评审视角小结

判断「一个 CLI 是不是好 skill」的三条标准：

1. **agent 读 SKILL.md 一次能跑通**：不需要看源码、不需要试错。当前 P0 那 5 个 bug + P0-2/P0-3 直接破坏这条。
2. **输出永远不灌爆 context**：大输出默认落盘，agent 收到的是路径而不是 base64。当前默认行为是反的。
3. **元数据是机器可读、与二进制同源**：`introspect` 而不是 `SKILL.md`，CI 防漂移。当前完全靠手写 markdown。

把这三条做对，cloakbrowser-cli 就从「一个能用的 CLI」升级为「agent 友好的 skill」。
