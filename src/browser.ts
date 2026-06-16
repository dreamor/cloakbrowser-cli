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
  launchPersistentContext?: (userDataDir: string, opts?: unknown) => Promise<AnyContext>;
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

  if (resolved.persistentDir) {
    if (!cb.launchPersistentContext) {
      throw new CloakError(
        'MISSING_DEPENDENCY',
        "Installed cloakbrowser does not expose launchPersistentContext (need >= 0.3.0)"
      );
    }
    const ctx = await cb.launchPersistentContext(resolved.persistentDir, resolved.launchOptions);
    return { kind: 'context', context: ctx, close: () => ctx.close() };
  }

  if (resolved.wantsContext && cb.launchContext) {
    const ctx = await cb.launchContext(resolved.launchOptions);
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

  const browser = await cb.launch(resolved.launchOptions);
  return { kind: 'browser', browser, close: () => browser.close() };
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
