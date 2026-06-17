# @dreamor/cloakbrowser-cli

> Agent-friendly CLI for [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) — stealth Chromium that passes every bot detection test. Covers all CloakBrowser features so other AI agents can drive a real browser from any shell.

```bash
npm install -g @dreamor/cloakbrowser-cli cloakbrowser playwright-core
cloak doctor                    # confirm everything is installed
cloak binary install            # one-time ~200MB Chromium download
cloak fetch https://example.com --markdown --pretty
```

## Why

CloakBrowser ships a Python/JS SDK plus a Python `python -m cloakbrowser` CLI for binary management and a `cloakserve` CDP gateway — but no CLI for the browser itself. Agents calling shell commands need a structured surface that covers **all** of CloakBrowser: launch options, fingerprint flags, humanize behaviors, page operations, content extraction, cookies, storage, network, multi-page sessions, and the CDP server.

`@dreamor/cloakbrowser-cli` is that surface.

## Two ways to use it

### A. **One-shot** (no daemon, per-command process)
Best for "fetch this URL and give me the markdown / a screenshot".
```bash
cloak fetch https://news.ycombinator.com --markdown --pretty
cloak fetch https://target.com --humanize --proxy=http://u:p@host:port --text
cloak scrape https://example.com --selector="h1" --multi
```

### B. **Daemon + long session** (agents driving multi-step flows)
Best for "log in, click around, scrape over several pages, take screenshots". Sessions can be named for easy reuse.
```bash
cloak daemon start
cloak session new --name=login --humanize
cloak goto @login https://demo.fingerprint.com
cloak wait @login --selector="#visitor-id"
cloak text @login --selector="#visitor-id"
cloak screenshot @login --path=./fp.png --full-page

# Use `-` to refer to the last-used session
cloak goto - https://example.com

# Or manage aliases manually
cloak session alias list
cloak session alias set mysession s-abc123

cloak session close @login
```

The daemon keeps `Browser`, `Context`, and `Page` instances alive between CLI invocations. Each `cloak <verb>` is a tiny RPC over a Unix socket at `~/.cloak/daemon.sock`.

## Install

```bash
npm install -g @dreamor/cloakbrowser-cli cloakbrowser playwright-core
```

Requires Node 20.0+. Peer deps `cloakbrowser` and `playwright-core` are installed alongside.

First real browser launch downloads the stealth Chromium binary (~200MB, cached at `~/.cloakbrowser/`). Pre-download with `cloak binary install`.

## Agent integration

Default output is single-line JSON on stdout, exit code 0/1. Errors go to stderr as JSON with a stable `code`. Designed so an agent can:

```bash
# 1. Start once per project; survives across many agent turns.
cloak daemon start >/dev/null

# 2. Create a named session.
cloak session new --name=target --humanize

# 3. Drive it. Use @name aliases instead of raw session IDs.
cloak goto @target https://target.com
SNAP=$(cloak snapshot @target)           # element uids, roles, names, bboxes
# agent reasons over $SNAP, picks an element with uid "u7"
# UIDs are auto-resolved — you can pass bare "u7" instead of a full selector
cloak click @target u7
cloak text @target --selector="#result"

# 3b. Use --snapshot to get a DOM snapshot after any interaction (saves a round-trip).
cloak click @target u7 --snapshot        # result includes { clicked, snapshot: {...} }

# 4. Or keep state across turns by saving cookies + localStorage.
cloak session save-state @target ./state.json
# later, in a fresh process:
cloak session new --storage-state=./state.json --name=resumed

# 5. Use `-` to refer to the last-used session across single-turn scripts.
cloak goto - https://example.com

The envelope is stable:
```jsonc
// Success
{ "ok": true, "data": <any>, "session_id": "s-abc12345", "page_id": "p-def09876" }
// Failure (non-zero exit code, written to stderr)
{ "ok": false, "error": { "code": "TIMEOUT", "message": "...", "details": {...} } }
```

Add `--pretty` for human-readable colored output (auto when stdout is a TTY). Add `--quiet` to emit only `data` (without the envelope) on success.

Error `code` values: `BOOT_ERROR`, `INVALID_ARG`, `INVALID_JSON`, `MISSING_DEPENDENCY`, `DAEMON_NOT_RUNNING`, `DAEMON_ALREADY_RUNNING`, `DAEMON_TIMEOUT`, `SESSION_NOT_FOUND`, `PAGE_NOT_FOUND`, `BROWSER_LAUNCH_FAILED`, `NAVIGATION_FAILED`, `TIMEOUT`, `SELECTOR_NOT_FOUND`, `EVAL_FAILED`, `NETWORK_ERROR`, `IO_ERROR`, `NOT_IMPLEMENTED`, `UNSUPPORTED_OPERATION`, `INTERNAL_ERROR`.

## Command map

### Daemon
| Command | What it does |
|---|---|
| `cloak daemon start [--log <path>]` | Spawn the daemon detached. |
| `cloak daemon stop` | Stop and free all sessions. |
| `cloak daemon status` | pid, uptime, session count. |
| `cloak daemon ping` | Round-trip health check. |
| `cloak daemon methods` | List all 56 RPC methods. |
| `cloak daemon foreground` | Run daemon attached for debugging. |

### Sessions
| Command | What it does |
|---|---|
| `cloak session new [opts]` | Returns `{session_id, page_id}`. Use `--name <alias>` to save a named reference. |
| `cloak session list` | All active sessions with metadata. |
| `cloak session info <id>` | Pages, ttl, launch opts. Accepts `@name` and `-`. |
| `cloak session close <id>` | Close + free resources. Accepts `@name` and `-`. |
| `cloak session save-state <id> <path>` | Dump `storageState` JSON. Accepts `@name` and `-`. |
| `cloak session alias list` | List all saved aliases. |
| `cloak session alias set <name> <sid>` | Save or overwrite an alias. |
| `cloak session alias remove <name>` | Remove a saved alias. |

### Pages
| Command | What it does |
|---|---|
| `cloak page new <sid>` | New tab in the session. |
| `cloak page list <sid>` | List tabs. |
| `cloak page close <sid> <pid>` | Close one tab. |
| `cloak page activate <sid> <pid>` | Make tab default for subsequent ops. |

### Navigation
`cloak goto <sid> <url>` · `back` · `forward` · `reload` · `url` · `title`

All accept `--page <pid>` and `--timeout <ms>`. `goto` also takes `--wait-until=load|domcontentloaded|networkidle|commit` and `--referer`. Add `--snapshot` to any navigation command to also return a compact DOM snapshot after the operation.

### Content extraction
`content` (HTML) · `text` (innerText, `--selector` to scope) · `html --selector` · `attr <sel> <name>` · `markdown` (Readability + Turndown) · `screenshot [--path] [--full-page] [--selector] [--format png|jpeg] [--quality]` · `pdf [--path] [--format A4] [--landscape]`

Binary outputs are returned as base64 by default; pass `--path=FILE` to write to disk (response includes `{path, size, sha256}`). The global `--out <path>` flag also works as a fallback for `--path`.

Text outputs (`content`, `text`, `html`, `markdown`) and one-shot commands (`fetch`, `scrape`) also respect `--out <path>`: when set, the JSON is written to the file and a metadata envelope `{ok, data: {path, size, sha256}}` is returned instead.

### Interaction (all use humanize when session was started with `--humanize`)
`click` · `dblclick` · `fill` · `type` · `press` · `hover` · `focus` · `blur` · `scroll [--to top|bottom|<sel>] [-x] [-y]` · `select <sid> <sel> <value...>` · `check` · `uncheck` · `upload <sid> <sel> <file...>` · `drag <sid> <from> <to>` · `dispatch <sid> <sel> <event_type> [--init <json>]`

All interaction commands accept bare cloak UIDs (e.g. `cloak click @session u7` — auto-resolved to `[data-cloak-uid="u7"]`). Add `--snapshot` to any interaction command to also return a compact DOM snapshot after the operation.

### Wait / Snapshot / Frames
`cloak wait <sid> [--selector] [--text] [--url] [--state visible|hidden|attached|detached] [--load-state load|networkidle] [--timeout]` · `cloak sleep <sid> <ms>` · `cloak snapshot <sid>` (a11y-style tree with uids) · `cloak frames <sid>` · `cloak a11y <sid>` (raw Playwright accessibility tree; returns `UNSUPPORTED_OPERATION` if unavailable — use `snapshot` instead)

`snapshot` is the recommended entry point for agent reasoning: it tags every visible interactive element with `data-cloak-uid` and returns role, name, attrs, bounding box, and a usable selector for each.

### JS evaluation
`cloak eval <sid> <expression> [--arg <json>]` · `cloak eval-file <sid> <path> [--arg <json>]`

### Cookies / Storage
`cloak cookies get <sid> [--url]` · `cloak cookies set <sid> --json <json>|--file <path>|stdin` · `cloak cookies clear <sid>`
`cloak storage save <sid> <path>` (storageState dump) · `cloak storage load` (only at session launch — recreate the session with `--storage-state`)
`cloak local-storage get|set|clear` · `cloak session-storage get|set|clear`

### Network
`cloak request <sid> <url> [--method] [--header "Name: Value"] [--body|--json|--form key=value] [--timeout]` — fires through the session's context.request, so cookies/proxy/fingerprint match the browser.

### Dialog
`cloak dialog <sid> --action=accept|dismiss [--text]` — install a one-shot handler for the next alert/confirm/prompt.

### One-shot helpers
`cloak fetch <url> [launch opts] [--wait-until] [--nav-timeout] [--referer] [--text] [--html] [--markdown] [--selector] [--screenshot [path]] [--full-page] [--pdf [path]]`
`cloak scrape <url> --selector <sel> [--multi] [--attr <name>] [launch opts]`

### Binary management
`cloak binary install|info|update|clear-cache` — uses cloakbrowser's JS surface (`ensureBinary`, `binaryInfo`, `clearCache`).

### CDP server passthrough
`cloak serve [--port] [--host] [--headless true|false] [--proxy-server]` — wraps `python -m cloakbrowser.cloakserve`. Requires the Python install of cloakbrowser.
`cloak connect <ws_url>` — create a session attached to an existing CDP endpoint.

### Self-test
`cloak doctor` · `cloak test [--detector fingerprintjs|browserscan|botd|sannysoft] [--humanize] [--proxy] [--screenshot <path>] [--wait-until load|domcontentloaded|networkidle|commit] [--timeout <ms>]` · `cloak version`

### Fingerprint help
`cloak fingerprint` — lists all fingerprint options and usage examples. Fingerprint flags are set at session creation (`session new`) or in one-shot commands (`fetch`, `scrape`); this command shows what's available.

## Launch options (shared by `session new`, `fetch`, `scrape`)

Every CloakBrowser launch flag is exposed:

- **Mode**: `--headless` / `--no-headless`, `--persistent <dir>` (cookies/state survive), `--channel <name>`
- **Network**: `--proxy <url>` (HTTP/SOCKS5), `--geoip` (auto timezone/locale from proxy exit IP)
- **Identity / fingerprint**: `--fingerprint <seed>` (deterministic), `--platform windows|macos|linux`, `--platform-version`, `--brand`, `--brand-version`, `--gpu-vendor`, `--gpu-renderer`, `--hardware-concurrency`, `--device-memory`, `--screen WxH`, `--webrtc-ip auto|<ip>`
- **Locale / display**: `--timezone`, `--locale`, `--user-agent`, `--viewport WxH`, `--color-scheme light|dark`
- **Humanize**: `--humanize`, `--humanize-preset careful|default|fast`, `--humanize-config <json>`
- **Context-level**: `--storage-state <path>`, `--extra-headers <json>`, `--permissions <json>`, `--extension <path>` (repeatable)
- **Misc**: `--extra-args <json>` (extra Chromium args), `--slow-mo <ms>`, `--timeout <ms>`

Context-level options or `--persistent` cause `cloak` to use `launchContext` / `launchPersistentContext` automatically.

## Examples

### Drive a login form with humanize
```bash
cloak daemon start
cloak session new --name=login --humanize --proxy=http://u:p@residential:port --geoip
cloak goto @login https://app.example.com/login
cloak fill @login 'input[name=email]' 'me@example.com'
cloak fill @login 'input[name=password]' "$PASSWORD"
cloak click @login 'button[type=submit]'
cloak wait @login --url='**/dashboard**'
cloak session save-state @login ./auth.json
cloak session close @login
```

### Resume the same session next run
```bash
cloak session new --name=dashboard --storage-state=./auth.json --humanize
cloak goto @dashboard https://app.example.com/dashboard
cloak screenshot @dashboard --path=./dashboard.png --full-page
```

### Agent reasoning over the page (snapshot + uid)
```bash
cloak session new --name=page
cloak goto @page https://example.com
cloak snapshot @page --pretty
# Agent picks { uid: "u3", role: "link", name: "More information..." }
cloak click @page u3
```

### After-action snapshot (saves a round-trip)
```bash
cloak click @page u7 --snapshot
# → { ok: true, data: { clicked: "u7", snapshot: { items: [...], url: "...", title: "..." } } }
```

### Beat fingerprint detection
```bash
# Reproducible identity (returning visitor)
cloak fetch https://demo.fingerprint.com --fingerprint=42 --humanize --markdown
# Pretend to be a Windows desktop
cloak fetch https://botscan.test --platform=windows --gpu-vendor='NVIDIA' --screen=1920x1080
```

### Build a quick scraper
```bash
cloak scrape https://news.ycombinator.com --selector='.titleline > a' --multi --attr=href
```

### Use through an existing CDP server
```bash
# Start cloakserve (requires Python install of cloakbrowser)
cloak serve --port=9222 --headless=false &
SID=$(cloak connect 'http://localhost:9222?fingerprint=42' | jq -r .data.session_id)
cloak goto "$SID" https://example.com
```

## File layout

```
~/.cloak/                Local state
├── daemon.sock          Unix socket for CLI ↔ daemon RPC
├── daemon.pid           Daemon process id
├── aliases.json         Session name aliases (@name → s-xxx)
├── last-session.txt     Last-used session ID (for `-` shorthand)
└── sessions/            Reserved for future per-session caches
```

## Environment variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `CLOAK_CLI_HOME` | No | Override `~/.cloak/` state directory | `~/.cloak` |
| `CLOAK_CLI_SOCK` | No | Override the daemon Unix socket path | `<CLOAK_CLI_HOME>/daemon.sock` |
| `PYTHON` | No | Python interpreter for `cloak serve` | `python3` |

## Architecture

```
┌─────────────┐   spawn        ┌──────────────────────┐
│  CLI client │ ─────────────► │  cloak-daemon (node) │
│ (commander) │                │ ───────────────────  │
│             │   JSON-RPC     │  sessions registry   │
│             │ ◄───over──────►│  cloakbrowser API    │
└─────────────┘   unix sock    │  playwright pages    │
                               └──────────────────────┘
       (one-shot fetch/scrape: in-process, no daemon)
```

- 56 RPC methods on the daemon, all listed by `cloak daemon methods`.
- One-shot mode (`fetch`, `scrape`) skips the daemon entirely for stateless requests.
- Session idle timeout: 1 hour by default; override with `--ttl-ms` on `session new`.

## Build from source

```bash
git clone <repo>
cd CloakBrowser-Cli
npm install
npm run build           # tsc → dist/
npm run typecheck
npm run test            # unit
npm run test:e2e        # daemon RPC plumbing (no browser)
CLOAK_BINARY_READY=1 npm run test:all   # full set, requires binary
npm link                # use `cloak` globally during dev
```

## Known limits

- `cloak serve` requires the **Python** install of cloakbrowser (`pip install cloakbrowser`) because `cloakserve` is a Python entry point. Node-only installs use `session new` for everything else.
- Widevine sideloading is Linux-only (cloakbrowser upstream constraint). Use `--persistent` with a pre-seeded profile on Linux.
- `storage.load` post-launch is not supported by Playwright; recreate the session with `--storage-state`.
- `network.recent` (live network event log) is reserved for a future version; use `cloak eval` with `performance.getEntriesByType("resource")` for a snapshot.

## License

MIT — see [LICENSE](LICENSE).
