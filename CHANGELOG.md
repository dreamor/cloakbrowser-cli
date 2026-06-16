# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
