# SKILL: CloakBrowser CLI

> Agent-friendly CLI for CloakBrowser — stealth Chromium that passes every bot detection test.

## Identity

- **Name**: cloakbrowser-cli
- **Display Name**: CloakBrowser CLI
- **Entry Point**: `cloak`
- **Install**: `npm install -g @dreamor/cloakbrowser-cli cloakbrowser playwright-core`
- **Package Manager**: npm
- **npm Package**: `@dreamor/cloakbrowser-cli`
- **Category**: web / browser-automation
- **Requires**: Node.js >= 20, cloakbrowser >= 0.3.0, playwright-core >= 1.40.0
- **Homepage**: https://github.com/dreamor/cloakbrowser-cli
- **Source**: https://github.com/dreamor/cloakbrowser-cli

## What It Does

CloakBrowser CLI (`cloak`) wraps the CloakBrowser stealth Chromium browser with a structured, agent-friendly command surface. It covers all CloakBrowser features: launch options, fingerprint flags, humanize behaviors, page operations, content extraction, cookies, storage, network, multi-page sessions, and a CDP server gateway.

AI agents can drive a real browser from any shell — fetch pages, fill forms, click elements, take screenshots, extract content, manage sessions, and bypass fingerprint detection — all with JSON output designed for programmatic consumption.

## Two Modes

### One-shot (no daemon)

Best for "fetch this URL and give me the markdown / a screenshot":

```bash
cloak fetch https://example.com --markdown --pretty
cloak fetch https://target.com --humanize --proxy=http://u:p@host:port --text
cloak scrape https://example.com --selector="h1" --multi
```

### Daemon + Long Session

Best for "log in, click around, scrape over several pages":

```bash
cloak daemon start
SID=$(cloak session new --humanize | jq -r .data.session_id)
cloak goto $SID https://demo.fingerprint.com
cloak wait $SID --selector="#visitor-id"
cloak text $SID --selector="#visitor-id"
cloak screenshot $SID --path=./fp.png --full-page
cloak session close $SID
```

## Command Reference

### Daemon

| Command | Description |
|---------|-------------|
| `cloak daemon start` | Spawn the daemon detached |
| `cloak daemon stop` | Stop and free all sessions |
| `cloak daemon status` | Show pid, uptime, session count |
| `cloak daemon ping` | Round-trip health check |
| `cloak daemon methods` | List all 56 RPC methods |

### Sessions

| Command | Description |
|---------|-------------|
| `cloak session new [opts]` | Create session, returns `{session_id, page_id}` |
| `cloak session list` | List active sessions |
| `cloak session info <id>` | Session details |
| `cloak session close <id>` | Close + free resources |
| `cloak session save-state <id> <path>` | Dump storageState JSON |

### Navigation

`cloak goto <sid> <url>` · `back` · `forward` · `reload` · `url` · `title`

### Content Extraction

`content` (HTML) · `text` (innerText) · `html` · `attr` · `markdown` · `screenshot` · `pdf`

### Interaction (humanize-aware)

All interaction commands accept both CSS selectors and bare cloak UIDs (`u7` → auto-resolved to `[data-cloak-uid="u7"]`):

`click` · `dblclick` · `fill` · `type` · `press` · `hover` · `focus` · `blur` · `scroll` · `select` · `check` · `uncheck` · `upload` · `drag` · `dispatch`

```bash
# Bare uid — auto-resolved
cloak click $SID u7
cloak fill $SID u7 "hello"
```

### Wait / Snapshot / Frames

`cloak wait <sid> [--selector] [--text] [--url] [--state] [--timeout]` · `sleep` · `snapshot` (a11y tree with uids) · `frames` · `a11y`

### Cookies / Storage

`cloak cookies get|set|clear` · `cloak storage save|load` · `cloak local-storage get|set|clear` · `cloak session-storage get|set|clear`

### Network

`cloak request <sid> <url> [--method] [--header] [--body|--json|--form]`

### One-shot Helpers

`cloak fetch <url> [opts] [--text] [--html] [--markdown] [--screenshot]` · `cloak scrape <url> --selector <sel> [--multi] [--attr]`

### Binary Management

`cloak binary install|info|update|clear-cache`

### Self-test

`cloak doctor` · `cloak test [--detector fingerprintjs|browserscan|botd|sannysoft] [--humanize] [--proxy] [--screenshot <path>] [--wait-until load|domcontentloaded|networkidle|commit] [--timeout <ms>]` • `cloak version`

## Launch Options

All CloakBrowser launch flags are exposed:

- **Mode**: `--headless` / `--no-headless`, `--persistent <dir>`, `--channel <name>`
- **Network**: `--proxy <url>`, `--geoip`
- **Fingerprint**: `--fingerprint <seed>`, `--platform`, `--brand`, `--gpu-vendor`, `--gpu-renderer`, `--hardware-concurrency`, `--device-memory`, `--screen WxH`, `--webrtc-ip`
- **Locale/Display**: `--timezone`, `--locale`, `--user-agent`, `--viewport WxH`, `--color-scheme`
- **Humanize**: `--humanize`, `--humanize-preset careful|default|fast`, `--humanize-config <json>`
- **Context**: `--storage-state <path>`, `--extra-headers <json>`, `--permissions <json>`, `--extension <path>`
- **Misc**: `--extra-args <json>`, `--slow-mo <ms>`, `--timeout <ms>`

## Output Format

Default output is single-line JSON on stdout, exit code 0/1:

```json
// Success
{ "ok": true, "data": <any>, "session_id": "s-abc12345", "page_id": "p-def09876" }
// Failure (non-zero exit code, stderr)
{ "ok": false, "error": { "code": "TIMEOUT", "message": "...", "details": {...} } }
```

Add `--pretty` for human-readable colored output. Add `--quiet` to emit only `data` on success.

### Large Output Handling

For binary or large text outputs:

- **`--path <file>`** (local flag) or **`--out <path>`** (global flag): writes output to a file and returns `{"path","size","sha256"}` metadata instead of inline base64/JSON
- Applies to: `screenshot`, `pdf`, `content`, `text`, `html`, `markdown`, and one-shot `fetch`/`scrape`
- Without these flags, text commands return JSON on stdout and screenshots/PDFs return base64

## Agent Integration Pattern

```bash
# 1. Start daemon once per project
cloak daemon start >/dev/null

# 2. Create session
SID=$(cloak session new --humanize | jq -r .data.session_id)

# 3. Drive it
cloak goto "$SID" https://target.com
SNAP=$(cloak snapshot "$SID")
# Agent reasons over $SNAP, picks element uid "u7"
# UIDs are auto-resolved — you can pass bare "u7" instead of '[data-cloak-uid="u7"]'
cloak click "$SID" u7
cloak text "$SID" --selector="#result"

# 4. Persist state across turns
cloak session save-state "$SID" ./state.json
# Later, in a fresh process:
SID=$(cloak session new --storage-state=./state.json | jq -r .data.session_id)
```

## Error Codes

`BOOT_ERROR`, `INVALID_ARG`, `INVALID_JSON`, `MISSING_DEPENDENCY`, `DAEMON_NOT_RUNNING`, `DAEMON_ALREADY_RUNNING`, `DAEMON_TIMEOUT`, `SESSION_NOT_FOUND`, `PAGE_NOT_FOUND`, `BROWSER_LAUNCH_FAILED`, `NAVIGATION_FAILED`, `TIMEOUT`, `SELECTOR_NOT_FOUND`, `EVAL_FAILED`, `NETWORK_ERROR`, `IO_ERROR`, `NOT_IMPLEMENTED`, `UNSUPPORTED_OPERATION`, `INTERNAL_ERROR`

## First-time Setup

```bash
npm install -g @dreamor/cloakbrowser-cli cloakbrowser playwright-core
cloak doctor                    # confirm everything is installed
cloak binary install            # one-time ~200MB Chromium download
```
