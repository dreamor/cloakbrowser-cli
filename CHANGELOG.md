# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.8] - 2026-09-04

Top-to-bottom correctness pass against a real stealth browser session: five root-cause clusters, verified end-to-end where a browser is required.

### Fixed

- **`page.evaluate()` with a string snippet + `arg` was silently ignored** (cluster of 7) — Playwright/cloakbrowser only invoke `pageFunction` and bind `arg` when given a *real* function. Every string arrow-function + arg pair — `scrape` (crashed), `local/session-storage set` (silent no-op reporting success), `blur`, `scroll --to <sel>` / `scroll -x -y`, `eval`/`eval-file --arg`, `wait --stable`, `wait --text` (resolved immediately without checking the page) — is now materialized via `utils/page-fn.ts#toPageFn()`.
- **Launch options were silently dropped by cloakbrowser** (cluster of 6) — options not in cloakbrowser's fixed top-level interface must be nested: `--extra-headers`/`--permissions`/`--storage-state` now go through `contextOptions`, `--slow-mo`/`--timeout`/`--channel` through `launchOptions`. Also fixed `--persistent` crashing with `The "path" argument must be of type string` (cloakbrowser's `launchPersistentContext` takes a single options object; the old `(dir, opts)` call shape never reached it).
- **`BOOT_ERROR` leaked for session-resolution failures** — `@alias`/`-`/`--session` typos escaped the JSON envelope through the bin-level catch and reported a fatal-looking `BOOT_ERROR` with stack. `callDaemon()` and `batch --session` now route through `fail()` → `SESSION_NOT_FOUND`.
- **Commander parse errors bypassed the envelope** — missing/unknown arguments/flags wrote plain text to stderr. The whole command tree now applies `exitOverride`/`configureOutput`/`allowExcessArguments(false)` (surplus positionals are rejected instead of silently dropped), and `ok()` failures (blocked/unwritable `--out` path) are caught at the single `emit()` choke point.
- **`snapshot` filtering order** — `--compact` stripped `bbox` *before* the viewport check ran, so `--compact --viewport-only --viewport-height=N` always returned 0 items; compact now runs last. `--viewport-only` without `--viewport-height` used to be a silent no-op; it now falls back to the live viewport size.
- **`network.recent` reported `ok:true` with empty data** — an agent reads that as "no requests were made". It now fails with `NOT_IMPLEMENTED` (matching `storage.load`) and points at the `performance.getEntriesByType("resource")` workaround.
- **Error-code mapping** — bogus `--license-key` threw a plain Error whose message carries the plan info; it now maps to `LICENSE_ERROR` via message shape, not just the `CloakBrowserLicenseError` name. `Download failed: HTTP 404` (pinned a nonexistent `--browser-version`) → `INVALID_ARG`; other download failures → `NETWORK_ERROR`. `Failed to launch …` → `BROWSER_LAUNCH_FAILED`; unrecognized `keyboard.press` keys → `INVALID_ARG`.
- **`cloak connect` was not a CDP attach at all** — it launched a brand-new browser with a Chromium-ignored `--remote-debugging-url` arg, so dead ports "succeeded" in ~1s. Reimplemented on `playwright-core` `chromium.connectOverCDP()` (new `session.connect` daemon method) with `--timeout` fail-fast; `session close` now only disconnects from a browser it didn't start.
- **Binary-not-installed launches polluted stdout** — cloakbrowser's ~200MB download progress lines went straight to stdout, breaking the "stdout is exactly one JSON envelope" contract. Everything `[cloakbrowser]`-prefixed is now rerouted to stderr (always restored, even on throw) with a one-line notice before the download starts.
- **`cloak version` showed `cloakbrowser: "unknown"`** — the dependency's package.json isn't exported; the version is now read directly by walking the same node_modules paths Node would.
- **`cloak serve` leaked a raw Python traceback** (missing interpreter/module) — a fast preflight now reports `MISSING_DEPENDENCY` through the normal envelope while the real server keeps live stdio logs.
- **Read/write path validation** — `session.save_state`, `storage.save`, and `cookies set --file` now go through `validateWritePath`/`validateReadPath`.
- **`cloak fingerprint` help recommended unregistered flags** — help text now matches the real short flags (`--platform`, `--screen`, …) that `buildFingerprintArgs` consumes.
- **`snapshot` key mismatch** — the standalone snapshot returned `elements` while after-action `--snapshot` returned `items`; both now return `items`.
- **`eval` polish** — `undefined` now serializes to JSON `null` (was the string `"undefined"`); multi-statement snippets fall back from expression-wrapping to a statement body instead of `EVAL_FAILED`.
- **`local/session-storage get <key>` ignored the key** — now reads just that entry (missing key → `{key: null}`); omitting it still returns everything.
- **`cloak dialog` blocked a full 30s** — `--timeout <ms>` is now exposed so agents can bound the wait.
- **`cloak test --detector=botd` pointed at a marketing page** — the original BotD demo is 404 upstream; it now targets the working fingerprint playground page.

### Changed

- Docs: verified against cloakbrowser 0.5.10; devDependency bumped accordingly; removed a stale security audit report whose findings are fixed in current versions.

## [0.5.7] - 2026-09-01

### Fixed

- **`fetch` masked navigation failures as success** — One-shot `cloak fetch <url>` caught `page.goto()` errors internally and returned `status: 'navigation-failed'` inside an `ok:true`/exit-0 envelope, breaking the documented ok/exit-code contract and making shell chaining (`cloak fetch $url && ...`) unsafe. Now emits `NAVIGATION_FAILED` (`ok:false`, exit 1) via `fail()`, with the partially-extracted data preserved under `error.details.partial` for agents that still want it. Matches the failure semantics already used by session-based `goto` and `scrape`.
- **GeoIP failures surfaced as unhelpful `INTERNAL_ERROR`** — cloakbrowser >= 0.5.10's `geoip.ts` now throws instead of silently returning nulls when `--geoip` can't resolve a timezone/locale (e.g. missing `mmdb-lib`, unreachable egress IP, database unavailable). `fromUnknown()` now maps these to `MISSING_DEPENDENCY`, `TIMEOUT`, or `NETWORK_ERROR` as appropriate instead of falling through to `INTERNAL_ERROR`.

### Changed

- **Docs** — Verified compatibility with cloakbrowser 0.5.10 (typecheck + full unit suite pass unmodified against it — public API surface is byte-identical to 0.5.9; only internal `download.ts` (added `showWelcome()`, unused by this CLI) and `geoip.ts` changed). Bumped devDependency to `cloakbrowser >=0.5.10`.

## [0.5.6] - 2026-08-28

### Fixed

- **Humanize actionability errors mapped to `INTERNAL_ERROR`** — cloakbrowser's `human/actionability.ts` throws `ElementNot{Attached,Visible,Stable,Enabled,Editable,ReceivingEvents}Error` / `ElementTargetChangedError` with message shape `Element "sel" failed <check> check: ...`, which didn't match the `/selector|locator/i` heuristic in `fromUnknown()`. Now matched by message shape and mapped to `TIMEOUT`, consistent with what non-humanized Playwright reports for the same underlying condition.

### Changed

- **Docs** — Verified compatibility with cloakbrowser 0.5.9 (typecheck + full unit suite pass unmodified against it — public API surface, i.e. `index.d.ts`/`playwright.d.ts`/`puppeteer.d.ts`/`config.d.ts`/`types.d.ts`, is byte-identical since 0.5.2; 0.5.8/0.5.9 only touched internal `human/*` humanize internals and the `license.ts` seat-lookup API, neither of which this CLI imports). Bumped devDependency to `cloakbrowser >=0.5.9` and refreshed recommended-version hints in README/SKILL.md/CONTRIBUTING.md.

## [0.5.5] - 2026-07-30

### Fixed

- **`--extension` never took effect** — CLI passed `extension_paths` (Python API name) to the JS wrapper, which only reads camelCase `extensionPaths`. Chrome extensions were silently ignored. Now serialized as `extensionPaths`; regression test covers the key name.

### Added

- **`--release-channel <stable|preview>`** — Opt into the CloakBrowser 0.5.2 Preview channel (also honors `CLOAKBROWSER_RELEASE_CHANNEL`).
- **`--no-fingerprint-noise`** — Disable fingerprint noise injection while keeping the deterministic seed (cloakbrowser 0.3.19).
- **`--fingerprint-allow-3p-cookies`** — Allow third-party cookies for reCAPTCHA v3 / SSO / payment flows (cloakbrowser 0.4.8).
- **`LICENSE_ERROR` error code** — Maps cloakbrowser 0.4.11's `CloakBrowserLicenseError` (detected by `err.name`) so Pro license denials surface with a clear code instead of `INTERNAL_ERROR`.

### Changed

- **peerDependency** — `cloakbrowser >=0.5.2` (was `>=0.3.0`). Devs bumped to `>=0.5.3`. Inline version hints refreshed.

## [0.5.4] - 2026-07-22

### Changed

- **CI** — Migrated npm publish to OIDC Trusted Publisher, removed static `NPM_TOKEN`.

## [0.5.3] - 2026-07-16

### Changed

- **Docs** — Added `CLOAKBROWSER_LICENSE_KEY` to `.env.example` and README env reference. Updated CONTRIBUTING.md recommended version to 0.4.10+.

## [0.5.2] - 2026-07-16

### Added

- **`--license-key` option** — Pass CloakBrowser Pro license key via CLI (also available via `CLOAKBROWSER_LICENSE_KEY` env var).
- **`--browser-version` option** — Pin/rollback to a specific Chromium build (e.g. `--browser-version=148.0.7778.215.5`).

### Changed

- **Docs** — Updated recommended cloakbrowser version to 0.4.10+ in README and SKILL.md.

## [0.5.1] - 2026-06-25

### Changed

- **Docs** — Updated CONTRIBUTING.md, SKILL.md, README.md with current dependency versions and RPC method count (54→62).

## [0.5.0] - 2026-06-25

### Changed

- **playwright-core peer** — Minimum version raised from `>=1.40.0` to `>=1.53.0` to match cloakbrowser 0.4.x requirements.
- **cloakbrowser devDependency** — Updated to `>=0.4.3` for development/testing against latest upstream.
- **New optional peers** — Added `mmdb-lib >=2.0.0` and `socks-proxy-agent >=10.0.0` as optional peerDependencies for cloakbrowser Pro GeoIP and SOCKS proxy features.
- **Version hints** — Updated inline version hints in `browser.ts` and `options.ts` to reflect 0.4.x baseline.
- **Docs** — Updated CONTRIBUTING.md, SKILL.md, README.md with current dependency versions and RPC method count (54→62).

## [0.4.1] - 2026-06-18

### Security

- **SafePath path validation** — New `SafePath` module prevents directory traversal attacks on file read/write operations. All file operations validate that resolved paths stay within allowed base directories. (S1)
- **Socket/permission hardening** — Unix domain socket set to `0600` and session directory to `0700` to prevent local privilege escalation. (S2)
- **Path validation enforcement** — File read/write operations now enforce SafePath traversal checks before any I/O. (S3)
- **Dialog timeout** — `dialog.handle_next` adds a configurable timeout (default 30s) to prevent resource leaks from abandoned dialogs. (S4)
- **Parameterized evaluate** — `oneShotScrape` and daemon `eval` method use parameterized `evaluate` instead of string concatenation, preventing JS injection via dynamic expressions. (S5)

### CI

- **NPM_TOKEN** — `release.yml` now uses `secrets.NPM_TOKEN` for npm publish authentication.
- **E2E build** — E2E CI job now runs `npm run build` before tests (jobs don't share workspace).
- **Node 22 compatibility** — Fixed JSON import in `cli.ts` to use `createRequire` for Node 22 ESM compatibility.

## [0.4.0] - 2026-06-17

### Added

- **Snapshot filters** — `--compact` (strips bbox/selector), `--limit <n>` (max elements), `--viewport-only` (elements in viewport), `--filter <expr>` (by role/tag/name), `--uid <uid>` (single element). All available on the `cloak snapshot` command. (O2)
- **Snapshot iframe support** — `--frames` flag includes elements from same-origin iframes in the snapshot result, with an `origin` field for disambiguation. (O4)
- **`cloak batch` command** — Execute multiple daemon RPCs from stdin JSON lines. Supports `--session <sid>` (default session) and `--abort-on-error`. Guards: `CLOAK_BATCH_MAX_BYTES` (1MB) and `CLOAK_BATCH_MAX_LINES` (200). (O1)
- **`wait --stable`** — New wait condition using MutationObserver to detect DOM stability. Configurable quiet period via `--quiet-ms` (default 500ms). Returns `{ stable, mutations }`. (O5)
- **Shared `SNAPSHOT_TAGGER_SCRIPT`** — In-page element tagger extracted to `params.ts`, shared between `page.snapshot` and `maybeSnapshot` to eliminate code duplication. (R2)

### Fixed

- **Missing `stable` in wait error message** — Error prompt now lists `stable` as a valid wait condition. (O5 cleanup)

### Changed

- **Default RPC timeout** — `DaemonClient.call()` now defaults to 30s timeout instead of no timeout. Can be overridden per-call. (O3)
- **Code deduplication** — Removed duplicate `optStr`/`reqStr` definitions from `eval.ts` and `network.ts`; all daemon methods now import from `params.ts`. (R1)

## [0.3.0] - 2026-06-17

### Added

- **UID auto-resolution** — Interaction commands (`click`, `fill`, `hover`, etc.) now accept bare cloak UIDs (`u7`, `u123`). They are automatically resolved to `[data-cloak-uid="..."]` selectors, eliminating the need for manual selector concatenation. (F1)
- **`--out` for text and one-shot commands** — The global `--out <path>` flag now works for all text outputs (`content`, `text`, `html`, `markdown`) and one-shot commands (`fetch`, `scrape`). When set, JSON is written to the specified file and a metadata envelope `{path, size, sha256}` is returned. (F2, F3)
- **Named sessions** — `session new --name login` saves the returned session ID under an alias. All daemon commands now accept `@name` (alias) or `-` (last-used session) instead of a raw session ID. `session alias list/set/remove` commands added for alias management. (P1-P7, P1-P8)
- **After-action snapshots** — Navigation and interaction commands accept `--snapshot` flag to return a compact DOM snapshot alongside the operation result, saving a round-trip. (P1-P9)
- **Shared parameter helpers** — `src/daemon/methods/params.ts` provides shared `optStr`, `reqStr`, `optNum`, `optBool`, and `resolveUid` functions, replacing 8+ redundant copies across daemon method files. (F12)

### Fixed

- **`oneShotFetch` navigation failures** — When `page.goto()` throws (timeout, DNS failure, etc.), the function now returns a partial result with `status: 'navigation-failed'` instead of crashing with an unhandled exception. (F5)
- **`--version` from `package.json`** — CLI version is now read dynamically from `package.json` instead of the hardcoded `'0.1.1'` in `src/cli.ts`, preventing drift. (F4)

### Changed

- **Docs updated** — SKILL.md and README.md updated with uid auto-resolution docs and `--out` coverage details.

## [0.2.2] - 2026-06-16

### Fixed

- **README docs staleness** — Fixed Node.js version requirement (18.17+ → 20.0+) and RPC method count (62 → 56) in README. (Starting this release, npm shows the corrected README.)
- **CONTRIBUTING.md docs staleness** — Fixed Node.js version requirement (18.17+ → 20.0+) and error code count (18 → 19).
- **SKILL.md docs staleness** — Fixed RPC method count (60+ → 56), added `UNSUPPORTED_OPERATION` to error codes list, expanded `cloak test` reference.

### Changed

- **CI: softprops/action-gh-release** — Updated from `v2` (Node 20) to `v3` (Node 24) to avoid deprecation warning as of 2026-06-16.

## [0.2.1] - 2026-06-16

### Fixed

- **README docs staleness** — Updated Node.js version requirement (18.17+ → 20.0+) and RPC method count (62 → 56) to match source code.

## [0.2.0] - 2026-06-16

### Added

- **Type shims for cloakbrowser v0.3.29+** — `buildLaunchOptions()`, `buildContextOptions()`, and `humanizeBrowser()` added to the `CloakModule` type definition in `src/browser.ts`. All three are optional for backward compatibility with older cloakbrowser versions.

### Changed

- **Proxy comment** — Added documentation note in `src/options.ts` confirming that proxy credential routing (URL-encoded passwords, inline `--proxy-server` bypass) is handled transparently by cloakbrowser >= 0.3.31.

## [0.1.1] - 2026-06-05

### Fixed

- **a11y crash** — `cloak a11y <sid>` threw `Cannot read properties of undefined (reading 'snapshot')` when `page.accessibility` was unavailable. Now returns a clear `UNSUPPORTED_OPERATION` error with a hint to use `cloak snapshot` instead.
- **page.new crash** — `cloak page new <sid>` threw `Please use browser.newContext()` for sessions created without context-level options. `getPageOrCreate()` now always creates an explicit `BrowserContext` before creating pages, instead of falling through to the implicit default context via `browser.newPage()`.
- **--out flag ignored** — The global `--out <path>` flag was parsed but never forwarded to screenshot/pdf output handling. `screenshot` and `pdf` commands now use `--out` as a fallback when `--path` is not specified.
- **fingerprint subcommand** — `cloak fingerprint` dumped the full help text because no subcommand was registered. Added a `fingerprint` command that lists all fingerprint options and usage examples.

### Changed

- **test command defaults** — `cloak test` now uses `domcontentloaded` (instead of `networkidle`) as the default navigation wait strategy, and adds `--wait-until` and `--timeout` options. This avoids 30s timeouts on sites with persistent WebSocket connections.
- **New error code** — Added `UNSUPPORTED_OPERATION` to the error code set for API features unavailable in the current browser/context.

## [0.1.0] - 2026-06-02

### Added

- **Daemon mode** — long-lived Unix socket server for multi-session workflows
  - `daemon start / stop / status / ping / methods / foreground`
  - JSON-line RPC protocol over `~/.cloak/daemon.sock`
  - Session registry with 1-hour idle TTL and auto-sweep
- **Session management** — create, list, close, save-state
  - Session IDs (`s-*`) and page IDs (`p-*`) for stable references
  - `session save-state` persists cookies + localStorage to JSON
- **Page management** — new, list, close, switch pages within a session
- **Navigation** — `goto`, `back`, `forward`, `reload`, `url`, `title`
- **Content extraction**
  - `content` (full HTML), `text`, `html`, `attr`, `markdown` (Readability + Turndown)
  - `screenshot` (PNG, optional selector/full-page), `pdf`
- **Interaction** — `click`, `dblclick`, `fill`, `type`, `press`, `hover`, `focus`, `blur`, `scroll`, `select`, `check`, `upload`, `drag`, `dispatch`
  - All interaction commands respect `--humanize` session flag
- **Wait & observation** — `wait` (selector/text/url/state/timeout), `sleep`, `snapshot` (a11y tree with `data-cloak-uid`), `frames`, `a11y`
- **JS evaluation** — `eval`, `eval-file` with optional `--arg <json>`
- **Cookies & storage** — `cookies`, `storage`, `local-storage`, `session-storage`
- **Network** — `request` (HTTP via page context)
- **Dialog** — `dialog` with accept/dismiss and optional text
- **One-shot helpers** (no daemon needed)
  - `fetch <url>` — launch, navigate, extract, close
  - `scrape <url>` — CSS selector scraping with `--attr` and `--multi`
- **Launch options** — 30+ flags: `--headless`, `--proxy`, `--geoip`, `--humanize`, `--fingerprint`, `--viewport`, `--timezone`, `--locale`, `--user-agent`, `--storage-state`, `--extensions`, `--extra-headers`, etc.
- **Binary management** — `binary install / info / clear-cache`
- **CDP passthrough** — `serve` (CDP gateway), `connect` (attach to existing CDP WebSocket)
- **Self-test** — `doctor` (dependency check), `test` (fingerprint test), `version`
- **Structured output** — JSON envelope with `ok`/`data`/`error`, `--pretty` (TTY auto), `--quiet` (data-only), `--out` (binary file)
- **Error codes** — 18 stable error codes for programmatic handling
- **Markdown conversion** — `@mozilla/readability` + `turndown` for clean article extraction
