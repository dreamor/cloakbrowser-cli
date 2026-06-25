# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-25

### Changed

- **playwright-core peer** — Minimum version raised from `>=1.40.0` to `>=1.53.0` to match cloakbrowser 0.4.x requirements.
- **cloakbrowser devDependency** — Updated to `>=0.4.3` for development/testing against latest upstream.
- **New optional peers** — Added `mmdb-lib >=2.0.0` and `socks-proxy-agent >=10.0.0` as optional peerDependencies for cloakbrowser Pro GeoIP and SOCKS proxy features.
- **Version hints** — Updated inline version hints in `browser.ts` and `options.ts` to reflect 0.4.x baseline.

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
