# Contributing to CloakBrowser CLI

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** ≥ 20.0
- **npm** ≥ 10
- **CloakBrowser** ≥ 0.3.0 (`npm install -g cloakbrowser` or as dev dependency)
- **Playwright** ≥ 1.40.0 (`npm install -g playwright-core`)

## Setup

```bash
git clone https://github.com/dreamor/cloakbrowser-cli.git
cd cloakbrowser-cli
npm install
npm run build
```

## Scripts Reference

<!-- AUTO-GENERATED from package.json scripts — do not edit manually -->

| Command | Description |
|---------|-------------|
| `npm run build` | Compile `src/` → `dist/` with `tsc` |
| `npm run dev` | Run CLI directly from source (no build step): `npm run dev -- goto <sid> <url>` |
| `npm run watch` | Auto-rebuild on file change (`tsc --watch`) |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run unit tests (Vitest, `tests/unit/`) |
| `npm run test:e2e` | Run end-to-end tests (Vitest, `tests/e2e/`) |
| `npm run test:all` | Run all tests (unit + e2e) |
| `npm run clean` | Remove `dist/` directory |
| `npm run prepublishOnly` | `clean` + `build` — runs automatically before `npm publish` |

<!-- END AUTO-GENERATED -->

## Development

```bash
# Run CLI in dev mode (no build step)
npm run dev -- <command> <args>

# Watch mode (auto-rebuild on change)
npm run watch

# Type check
npm run typecheck
```

## Testing

```bash
# Unit tests only
npm test

# E2E tests (requires CloakBrowser binary installed)
npm run test:e2e

# All tests
npm run test:all
```

### Writing Tests

- Unit tests go in `tests/unit/` — use Vitest
- E2E tests go in `tests/e2e/` — they launch a real browser
- Follow the Arrange-Act-Assert pattern
- Aim for descriptive test names

## Project Structure

```
src/
├── cli.ts                  # Commander program definition
├── client.ts               # DaemonClient (JSON-RPC over Unix socket)
├── one-shot.ts             # One-shot fetch/scrape (no daemon)
├── options.ts              # Launch options types and CLI flags
├── output.ts               # Output envelope formatting
├── errors.ts               # CloakError with 19 error codes
├── browser.ts              # CloakBrowser loader and launch logic
├── commands/               # Command builders (one file per domain)
├── daemon/                 # Daemon server, protocol, registry
│   ├── entry.ts            # Daemon process entry point
│   ├── lifecycle.ts        # Daemon spawn/stop/status
│   ├── server.ts           # Unix socket server
│   ├── protocol.ts         # JSON-line RPC wire format
│   ├── registry.ts         # Session/page registry
│   └── methods/            # RPC method implementations
└── utils/                  # Shared utilities
    ├── paths.ts            # Path constants (~/.cloak)
    ├── parse.ts            # Input parsers
    └── markdown.ts         # HTML → Markdown conversion
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Make changes** with clear, focused commits
4. **Add tests** for new functionality — maintain ≥ 80% coverage
5. **Run the full suite**: `npm run typecheck && npm run test:all`
6. **Open a PR** with:
   - A clear description of what and why
   - Reference to any related issues
   - Verification steps

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add --pdf flag to fetch command
fix: handle ECONNREFUSED in daemon client
docs: update README with proxy examples
refactor: extract viewport parsing to utils
test: add unit tests for markdown conversion
chore: bump vitest to 2.1.0
```

## Code Style

- **TypeScript strict mode** — enabled in `tsconfig.json`
- **ESM** — the project uses `"type": "module"`
- **Immutable patterns** — prefer `const`, spread, and `Object.freeze`
- **Error handling** — use `CloakError` with appropriate error codes from `src/errors.ts`
- **Output** — always use `ok()` / `fail()` from `src/output.ts`, never `console.log` directly

## Reporting Issues

- **Bugs**: Open an issue with reproduction steps, expected vs actual behavior, and CLI version (`cloak version`)
- **Features**: Open an issue with the use case and proposed command interface

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
