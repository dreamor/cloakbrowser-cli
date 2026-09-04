import { CloakError } from './errors.js';
import type { ResolvedLaunchOpts } from './options.js';

// Use unknown for Playwright/cloakbrowser types — they live in peer deps
// that may not be available at compile time.
export type AnyBrowser = {
  newPage: (opts?: unknown) => Promise<AnyPage>;
  newContext: (opts?: unknown) => Promise<AnyContext>;
  contexts: () => AnyContext[];
  close: () => Promise<void>;
  version?: () => string;
};

export type AnyContext = {
  newPage: () => Promise<AnyPage>;
  pages: () => AnyPage[];
  cookies: (urls?: string | string[]) => Promise<unknown[]>;
  addCookies: (cookies: unknown[]) => Promise<void>;
  clearCookies: () => Promise<void>;
  storageState: (opts?: { path?: string }) => Promise<unknown>;
  setExtraHTTPHeaders: (h: Record<string, string>) => Promise<void>;
  grantPermissions: (perms: string[], opts?: unknown) => Promise<void>;
  request: AnyRequest;
  close: () => Promise<void>;
  browser?: () => AnyBrowser | null;
};

export type AnyPage = {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  goBack: (opts?: unknown) => Promise<unknown>;
  goForward: (opts?: unknown) => Promise<unknown>;
  reload: (opts?: unknown) => Promise<unknown>;
  url: () => string;
  title: () => Promise<string>;
  content: () => Promise<string>;
  screenshot: (opts?: unknown) => Promise<Buffer>;
  pdf: (opts?: unknown) => Promise<Buffer>;
  evaluate: <T = unknown>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]) => Promise<T>;
  click: (selector: string, opts?: unknown) => Promise<void>;
  dblclick: (selector: string, opts?: unknown) => Promise<void>;
  fill: (selector: string, value: string, opts?: unknown) => Promise<void>;
  type: (selector: string, text: string, opts?: unknown) => Promise<void>;
  hover: (selector: string, opts?: unknown) => Promise<void>;
  focus: (selector: string, opts?: unknown) => Promise<void>;
  selectOption: (selector: string, values: unknown, opts?: unknown) => Promise<string[]>;
  check: (selector: string, opts?: unknown) => Promise<void>;
  uncheck: (selector: string, opts?: unknown) => Promise<void>;
  setInputFiles: (selector: string, files: unknown, opts?: unknown) => Promise<void>;
  dragAndDrop: (from: string, to: string, opts?: unknown) => Promise<void>;
  dispatchEvent: (selector: string, type: string, eventInit?: unknown) => Promise<void>;
  waitForSelector: (selector: string, opts?: unknown) => Promise<unknown>;
  waitForLoadState: (state?: string, opts?: unknown) => Promise<void>;
  waitForURL: (url: string | RegExp, opts?: unknown) => Promise<void>;
  waitForFunction: (fn: string | ((...args: unknown[]) => unknown), arg?: unknown, opts?: unknown) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  innerText: (selector: string, opts?: unknown) => Promise<string>;
  innerHTML: (selector: string, opts?: unknown) => Promise<string>;
  textContent: (selector: string, opts?: unknown) => Promise<string | null>;
  getAttribute: (selector: string, name: string, opts?: unknown) => Promise<string | null>;
  accessibility: { snapshot: (opts?: unknown) => Promise<unknown> };
  keyboard: { press: (key: string, opts?: unknown) => Promise<void>; type: (text: string, opts?: unknown) => Promise<void> };
  mouse: { move: (x: number, y: number) => Promise<void>; click: (x: number, y: number, opts?: unknown) => Promise<void> };
  frames: () => Array<{ url: () => string; name: () => string }>;
  close: () => Promise<void>;
  isClosed: () => boolean;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  route: (pattern: string | RegExp, handler: (...args: unknown[]) => void) => Promise<void>;
  unroute: (pattern: string | RegExp, handler?: (...args: unknown[]) => void) => Promise<void>;
  context: () => AnyContext;
};

export type AnyRequest = {
  fetch: (url: string, opts?: unknown) => Promise<{
    status: () => number;
    statusText: () => string;
    headers: () => Record<string, string>;
    text: () => Promise<string>;
    body: () => Promise<Buffer>;
    json: () => Promise<unknown>;
    ok: () => boolean;
    url: () => string;
  }>;
};

type CloakModule = {
  launch: (opts?: unknown) => Promise<AnyBrowser>;
  launchContext?: (opts?: unknown) => Promise<AnyContext>;
  // Real signature is a single options object with `userDataDir` merged in
  // — NOT `(userDataDir, opts)`. Confirmed empirically: the 2-arg form
  // throws `The "path" argument must be of type string. Received undefined`
  // because cloakbrowser reads `options.userDataDir`, not a first positional arg.
  launchPersistentContext?: (opts: Record<string, unknown>) => Promise<AnyContext>;
  ensureBinary?: () => Promise<string>;
  binaryInfo?: () => unknown;
  clearCache?: () => unknown;
  // Optional helpers exported since cloakbrowser v0.3.29.
  // buildLaunchOptions – builds Playwright launch options from raw config
  //   (resolves binary path, proxy, geoip, stealth args).
  // buildContextOptions – builds Playwright context options from raw config
  //   (strips locale/timezone from context-level opts).
  // humanizeBrowser – applies human-like behavioral layer to an existing
  //   Playwright browser instance (lazy-imported, no-op if humanize disabled).
  buildLaunchOptions?: (raw: Record<string, unknown>) => Promise<Record<string, unknown>>;
  buildContextOptions?: (raw: Record<string, unknown>) => Record<string, unknown>;
  humanizeBrowser?: (browser: AnyBrowser, opts?: Record<string, unknown>) => Promise<void>;
};

let cached: CloakModule | undefined;

export async function loadCloakBrowser(): Promise<CloakModule> {
  if (cached) return cached;
  try {
    const mod = (await import('cloakbrowser')) as unknown as CloakModule;
    cached = mod;
    return mod;
  } catch (err) {
    throw new CloakError(
      'MISSING_DEPENDENCY',
      "Cannot load 'cloakbrowser'. Install with: npm install cloakbrowser playwright-core",
      { cause: (err as Error).message }
    );
  }
}

export type LaunchedHandle =
  | { kind: 'browser'; browser: AnyBrowser; close: () => Promise<void> }
  | { kind: 'context'; context: AnyContext; close: () => Promise<void> };

export async function launchFromResolved(resolved: ResolvedLaunchOpts): Promise<LaunchedHandle> {
  const cb = await loadCloakBrowser();
  warnIfBinaryMissing(cb);

  if (resolved.persistentDir) {
    if (!cb.launchPersistentContext) {
      throw new CloakError(
        'MISSING_DEPENDENCY',
        "Installed cloakbrowser does not expose launchPersistentContext (need cloakbrowser >= 0.5.2)"
      );
    }
    const ctx = await withCloakbrowserStdoutRerouted(() =>
      cb.launchPersistentContext!({ ...resolved.launchOptions, userDataDir: resolved.persistentDir })
    );
    return { kind: 'context', context: ctx, close: () => ctx.close() };
  }

  if (resolved.wantsContext && cb.launchContext) {
    const ctx = await withCloakbrowserStdoutRerouted(() => cb.launchContext!(resolved.launchOptions));
    return {
      kind: 'context',
      context: ctx,
      close: async () => {
        const owner = ctx.browser?.();
        await ctx.close();
        if (owner) await owner.close().catch(() => undefined);
      },
    };
  }

  const browser = await withCloakbrowserStdoutRerouted(() => cb.launch(resolved.launchOptions));
  return { kind: 'browser', browser, close: () => browser.close() };
}

/**
 * Attach to an already-running browser's CDP endpoint (`--remote-debugging-port`
 * or a `ws://.../devtools/browser/<id>` URL). This is a genuine remote-attach,
 * unlike `cb.launch()` — closing the returned handle only disconnects, it
 * doesn't kill a browser this process didn't start.
 *
 * cloakbrowser doesn't expose a connect API (it only launches), so this goes
 * straight to playwright-core's `chromium.connectOverCDP`, which also gives
 * us a real connection timeout instead of hanging indefinitely on a dead port.
 */
export async function connectOverCdp(url: string, timeoutMs = 10_000): Promise<LaunchedHandle> {
  let chromium: { connectOverCDP: (endpoint: string, opts?: unknown) => Promise<AnyBrowser> };
  try {
    ({ chromium } = (await import('playwright-core')) as unknown as {
      chromium: { connectOverCDP: (endpoint: string, opts?: unknown) => Promise<AnyBrowser> };
    });
  } catch (err) {
    throw new CloakError(
      'MISSING_DEPENDENCY',
      "Cannot load 'playwright-core'. Install with: npm install playwright-core",
      { cause: (err as Error).message }
    );
  }
  let browser: AnyBrowser;
  try {
    browser = await chromium.connectOverCDP(url, { timeout: timeoutMs });
  } catch (err) {
    throw new CloakError('NETWORK_ERROR', `Failed to connect to CDP endpoint ${url}: ${(err as Error).message}`);
  }
  return { kind: 'browser', browser, close: () => browser.close() };
}

/**
 * `cb.launch()`/`launchContext()`/`launchPersistentContext()` silently
 * block on a synchronous ~200MB Chromium download the first time, with no
 * progress output — an agent watching stdout for a JSON response sees
 * nothing and has no way to tell "slow download" apart from "hung
 * process". This is a one-line, best-effort stderr heads-up (never
 * throws, never blocks) so that distinction is visible; it doesn't (and
 * can't, from out here) add a real progress bar to cloakbrowser's own
 * downloader.
 */
function warnIfBinaryMissing(cb: CloakModule): void {
  try {
    const info = cb.binaryInfo?.() as { installed?: boolean } | undefined;
    if (info?.installed === false) {
      process.stderr.write(
        'cloak: stealth Chromium binary not installed yet — downloading now (~200MB, one-time, will block until done). ' +
        'Pre-download ahead of time with `cloak binary install` to avoid this on the first real call.\n'
      );
    }
  } catch {
    // best-effort only — never let a binaryInfo() failure block a launch
  }
}

/**
 * cloakbrowser's own binary-download progress ("[cloakbrowser] Stealth
 * Chromium ... Downloading...") writes straight to process.stdout, which
 * would land in the middle of this CLI's "stdout is exactly one JSON
 * envelope" contract on a first install and break any agent doing
 * `JSON.parse(stdout)`. Reroute anything with that prefix to stderr for
 * the duration of the call — always restoring the original writer, even
 * if the call throws.
 */
export async function withCloakbrowserStdoutRerouted<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.stdout.write;
  const patched = (...args: unknown[]): boolean => {
    const [chunk] = args;
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : '';
    if (text.startsWith('[cloakbrowser]')) {
      return (process.stderr.write as (...a: unknown[]) => boolean).apply(process.stderr, args);
    }
    return (original as (...a: unknown[]) => boolean).apply(process.stdout, args);
  };
  process.stdout.write = patched as typeof process.stdout.write;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

export async function getPageOrCreate(handle: LaunchedHandle): Promise<AnyPage> {
  if (handle.kind === 'context') {
    const pages = handle.context.pages();
    const existing = pages[0];
    if (existing && !existing.isClosed()) return existing;
    return handle.context.newPage();
  }
  // For browser-kind handles, always use an explicit context to avoid
  // the implicit default context that forbids newPage() in some engines.
  const ctx = await getDefaultContext(handle);
  const pages = ctx.pages();
  const existing = pages[0];
  if (existing && !existing.isClosed()) return existing;
  return ctx.newPage();
}

export async function getDefaultContext(handle: LaunchedHandle): Promise<AnyContext> {
  if (handle.kind === 'context') return handle.context;
  const ctxs = handle.browser.contexts();
  const first = ctxs[0];
  if (first) return first;
  return handle.browser.newContext();
}
