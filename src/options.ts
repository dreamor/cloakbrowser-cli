import type { Command } from 'commander';
import { CloakError } from './errors.js';
import { parseViewport, parseJsonArg, parseInteger } from './utils/parse.js';

export type ReleaseChannel = 'stable' | 'preview';

/**
 * Raw CLI option set for launching a CloakBrowser session.
 * Maps to the union of: launch / launchContext / launchPersistentContext.
 */
export type LaunchOpts = {
  // Mode
  headless?: boolean;
  persistent?: string;
  channel?: string;
  releaseChannel?: ReleaseChannel;

  // Proxy + geo
  proxy?: string;
  geoip?: boolean;
  timezone?: string;
  locale?: string;
  colorScheme?: 'light' | 'dark' | 'no-preference';

  // Identity
  userAgent?: string;
  viewport?: string;
  fingerprint?: string;
  fingerprintNoise?: boolean;
  fingerprintAllow3pCookies?: boolean;
  platform?: 'windows' | 'macos' | 'linux';
  platformVersion?: string;
  brand?: string;
  brandVersion?: string;
  gpuVendor?: string;
  gpuRenderer?: string;
  hardwareConcurrency?: string;
  deviceMemory?: string;
  screen?: string;
  webrtcIp?: string;

  // Humanize
  humanize?: boolean;
  humanizePreset?: string;
  humanizeConfig?: string;

  // Context-level
  storageState?: string;
  extraHeaders?: string;
  permissions?: string;
  extensions?: string[];
  extraArgs?: string;

  // Pro
  licenseKey?: string;
  browserVersion?: string;

  // Misc
  slowMo?: string;
  timeout?: string;
};

export type ResolvedLaunchOpts = {
  launchOptions: Record<string, unknown>;
  persistentDir?: string;
  wantsContext: boolean;
};

const FINGERPRINT_FLAGS: ReadonlyArray<readonly [keyof LaunchOpts, string]> = [
  ['fingerprint', '--fingerprint'],
  ['platform', '--fingerprint-platform'],
  ['platformVersion', '--fingerprint-platform-version'],
  ['brand', '--fingerprint-brand'],
  ['brandVersion', '--fingerprint-brand-version'],
  ['gpuVendor', '--fingerprint-gpu-vendor'],
  ['gpuRenderer', '--fingerprint-gpu-renderer'],
  ['hardwareConcurrency', '--fingerprint-hardware-concurrency'],
  ['deviceMemory', '--fingerprint-device-memory'],
  ['webrtcIp', '--fingerprint-webrtc-ip'],
];

function buildFingerprintArgs(opts: LaunchOpts): string[] {
  const args: string[] = [];
  for (const [key, flag] of FINGERPRINT_FLAGS) {
    const v = opts[key];
    if (v !== undefined && v !== '') args.push(`${flag}=${v}`);
  }
  if (opts.screen) {
    const parsed = parseViewport(opts.screen);
    if (parsed) {
      args.push(`--fingerprint-screen-width=${parsed.width}`);
      args.push(`--fingerprint-screen-height=${parsed.height}`);
    }
  }
  if (opts.fingerprintNoise === false) {
    args.push('--fingerprint-noise=false');
  }
  if (opts.fingerprintAllow3pCookies) {
    args.push('--fingerprint-allow-3p-cookies');
  }
  return args;
}

export function resolveLaunchOpts(opts: LaunchOpts): ResolvedLaunchOpts {
  const launchOptions: Record<string, unknown> = {};
  // cloakbrowser's LaunchOptions/LaunchContextOptions only define a fixed
  // top-level field set (headless, proxy, userAgent, viewport, ...). Fields
  // that aren't in that interface — but are real Playwright launch()/
  // newContext() options — are silently dropped unless nested under these
  // two passthrough properties. Confirmed empirically against cloakbrowser
  // 0.5.10: top-level `extraHTTPHeaders`/`storageState`/`slowMo` are all
  // no-ops; nesting them here is what actually applies them.
  const rawLaunchOptions: Record<string, unknown> = {};
  const contextOptions: Record<string, unknown> = {};

  if (opts.headless !== undefined) launchOptions.headless = opts.headless;
  if (opts.channel) rawLaunchOptions.channel = opts.channel;
  if (opts.releaseChannel) {
    if (opts.releaseChannel !== 'stable' && opts.releaseChannel !== 'preview') {
      throw new CloakError(
        'INVALID_ARG',
        `--release-channel must be 'stable' or 'preview' (got '${opts.releaseChannel}')`
      );
    }
    launchOptions.releaseChannel = opts.releaseChannel;
  }
  // Proxy credential routing (URL-encoded special chars in passwords,
  // inline --proxy-server bypass for HTTP-on-supported-platforms) is
  // handled transparently by cloakbrowser >= 0.4.0 inside launch().
  if (opts.proxy) launchOptions.proxy = opts.proxy;
  if (opts.geoip !== undefined) launchOptions.geoip = opts.geoip;
  if (opts.humanize !== undefined) launchOptions.humanize = opts.humanize;
  if (opts.humanizePreset) launchOptions.humanPreset = opts.humanizePreset;
  if (opts.humanizeConfig) {
    launchOptions.humanConfig = parseJsonArg(opts.humanizeConfig, 'humanize-config');
  }
  if (opts.licenseKey) launchOptions.licenseKey = opts.licenseKey;
  if (opts.browserVersion) launchOptions.browserVersion = opts.browserVersion;

  const viewport = parseViewport(opts.viewport);
  if (viewport) launchOptions.viewport = viewport;
  if (opts.userAgent) launchOptions.userAgent = opts.userAgent;
  if (opts.locale) launchOptions.locale = opts.locale;
  if (opts.timezone) launchOptions.timezoneId = opts.timezone;
  if (opts.colorScheme) launchOptions.colorScheme = opts.colorScheme;
  if (opts.storageState) contextOptions.storageState = opts.storageState;
  if (opts.extraHeaders) {
    contextOptions.extraHTTPHeaders = parseJsonArg(opts.extraHeaders, 'extra-headers');
  }
  if (opts.permissions) {
    contextOptions.permissions = parseJsonArg<string[]>(opts.permissions, 'permissions');
  }
  if (opts.extensions && opts.extensions.length > 0) {
    // Verified against cloakbrowser's Chromium 146 AND stock Chrome: the args
    // reached the browser process (--load-extension + --disable-extensions-except,
    // with Playwright's --disable-extensions default stripped via
    // ignoreDefaultArgs and the DisableLoadExtensionCommandLineSwitch feature
    // disabled), yet content scripts never injected. Chromium 137+ removed
    // command-line extension side-loading entirely — headful, headless,
    // persistent profile, all dead. Fail loudly instead of accepting config
    // that can only ever be a silent no-op. Pre-installing into a --persistent
    // profile via chrome://extensions still works; the prefs are MAC-protected
    // so we can't do that registration for the user.
    throw new CloakError(
      'UNSUPPORTED_OPERATION',
      '--extension is not supported: Chromium 137+ removed command-line extension '
      + 'loading (--load-extension is ignored even headful with --persistent). '
      + 'Pre-install the extension into a --persistent profile via chrome://extensions instead.'
    );
  }
  if (opts.slowMo !== undefined) {
    rawLaunchOptions.slowMo = parseInteger(opts.slowMo, 'slow-mo');
  }
  if (opts.timeout !== undefined) {
    rawLaunchOptions.timeout = parseInteger(opts.timeout, 'timeout');
  }

  const args: string[] = [];
  args.push(...buildFingerprintArgs(opts));
  if (opts.extraArgs) {
    const extra = parseJsonArg<string[]>(opts.extraArgs, 'extra-args') ?? [];
    if (!Array.isArray(extra) || !extra.every((s) => typeof s === 'string')) {
      throw new CloakError('INVALID_ARG', '--extra-args must be a JSON array of strings');
    }
    args.push(...extra);
  }
  if (args.length > 0) launchOptions.args = args;

  if (Object.keys(rawLaunchOptions).length > 0) launchOptions.launchOptions = rawLaunchOptions;
  if (Object.keys(contextOptions).length > 0) launchOptions.contextOptions = contextOptions;

  const persistentDir = opts.persistent;
  const wantsContext = Boolean(
    persistentDir ||
      opts.userAgent ||
      opts.viewport ||
      opts.locale ||
      opts.timezone ||
      opts.colorScheme ||
      opts.storageState ||
      opts.extraHeaders ||
      opts.permissions
    // (opts.extensions removed: --extension now throws UNSUPPORTED_OPERATION
    // before this point — Chromium 137+ dropped command-line side-loading.)
  );

  const resolved: ResolvedLaunchOpts = { launchOptions, wantsContext };
  if (persistentDir) resolved.persistentDir = persistentDir;
  return resolved;
}

export type CliOptionDef = {
  flags: string;
  description: string;
  parser?: (value: string, previous: unknown) => unknown;
  defaultValue?: unknown;
};

const collect = (value: string, previous: unknown): string[] => {
  const arr = Array.isArray(previous) ? (previous as string[]) : [];
  return [...arr, value];
};

export const LAUNCH_OPTION_DEFS: readonly CliOptionDef[] = [
  { flags: '--headless', description: 'Run headless (default)' },
  { flags: '--no-headless', description: 'Run with a visible window' },
  { flags: '--proxy <url>', description: 'Proxy (http://user:pass@host:port or socks5://...)' },
  { flags: '--geoip', description: 'Auto-detect timezone/locale from proxy exit IP' },
  { flags: '--humanize', description: 'Enable human-like mouse/keyboard/scroll behavior' },
  { flags: '--humanize-preset <name>', description: 'Humanize preset (careful|default|fast)' },
  { flags: '--humanize-config <json>', description: 'Custom humanize config as JSON' },
  { flags: '--license-key <key>', description: 'CloakBrowser Pro license key (env: CLOAKBROWSER_LICENSE_KEY)' },
  { flags: '--browser-version <version>', description: 'Pin to a specific Chromium build (e.g. 148.0.7778.215.5)' },
  { flags: '--release-channel <name>', description: "Binary release channel (stable|preview; env: CLOAKBROWSER_RELEASE_CHANNEL)" },
  { flags: '--fingerprint <seed>', description: 'Deterministic fingerprint seed' },
  { flags: '--no-fingerprint-noise', description: 'Disable fingerprint noise injection (keep seed deterministic)' },
  { flags: '--fingerprint-allow-3p-cookies', description: 'Allow third-party cookies (reCAPTCHA v3 / SSO / payment)' },
  { flags: '--timezone <id>', description: 'Timezone (e.g. America/New_York)' },
  { flags: '--locale <id>', description: 'Locale (e.g. en-US)' },
  { flags: '--user-agent <ua>', description: 'Override User-Agent' },
  { flags: '--viewport <WxH>', description: 'Viewport size (e.g. 1920x1080)' },
  { flags: '--platform <name>', description: 'Fingerprint platform (windows|macos|linux)' },
  { flags: '--platform-version <v>', description: 'Fingerprint platform version' },
  { flags: '--brand <name>', description: 'Browser brand' },
  { flags: '--brand-version <v>', description: 'Browser brand version' },
  { flags: '--gpu-vendor <v>', description: 'Spoofed GPU vendor' },
  { flags: '--gpu-renderer <v>', description: 'Spoofed GPU renderer' },
  { flags: '--hardware-concurrency <n>', description: 'navigator.hardwareConcurrency' },
  { flags: '--device-memory <n>', description: 'navigator.deviceMemory (GB)' },
  { flags: '--screen <WxH>', description: 'Spoofed screen size' },
  { flags: '--webrtc-ip <ip>', description: 'WebRTC ICE candidate IP (auto|<ip>)' },
  { flags: '--color-scheme <name>', description: 'Color scheme (light|dark|no-preference; no-preference currently behaves as light — Chromium limitation)' },
  { flags: '--persistent <dir>', description: 'Use persistent user data dir (cookies/state survive)' },
  { flags: '--storage-state <path>', description: 'Load storage state from JSON file' },
  { flags: '--extra-headers <json>', description: 'Extra HTTP headers as JSON object' },
  { flags: '--permissions <json>', description: 'Permissions array as JSON' },
  { flags: '--extension <path>', description: 'Load a Chrome extension (currently UNSUPPORTED: Chromium 137+ removed --load-extension side-loading)', parser: collect, defaultValue: [] },
  { flags: '--extra-args <json>', description: 'Extra Chromium args as JSON array' },
  { flags: '--channel <name>', description: 'Chromium channel override' },
  { flags: '--slow-mo <ms>', description: 'Slow down operations by N ms' },
  { flags: '--timeout <ms>', description: 'Browser launch timeout (ms)' },
];

export function attachLaunchOptions(cmd: Command): Command {
  for (const def of LAUNCH_OPTION_DEFS) {
    if (def.parser) {
      cmd.option(def.flags, def.description, def.parser as never, def.defaultValue as never);
    } else if (def.defaultValue !== undefined) {
      cmd.option(def.flags, def.description, def.defaultValue as never);
    } else {
      cmd.option(def.flags, def.description);
    }
  }
  return cmd;
}

export function pickLaunchOpts(o: Record<string, unknown>): LaunchOpts {
  const get = <T>(k: string): T | undefined => (o[k] === undefined ? undefined : (o[k] as T));
  return {
    headless: get<boolean>('headless'),
    persistent: get<string>('persistent'),
    channel: get<string>('channel'),
    releaseChannel: get<ReleaseChannel>('releaseChannel'),
    proxy: get<string>('proxy'),
    geoip: get<boolean>('geoip'),
    timezone: get<string>('timezone'),
    locale: get<string>('locale'),
    colorScheme: get<'light' | 'dark' | 'no-preference'>('colorScheme'),
    userAgent: get<string>('userAgent'),
    viewport: get<string>('viewport'),
    fingerprint: get<string>('fingerprint'),
    fingerprintNoise: get<boolean>('fingerprintNoise'),
    fingerprintAllow3pCookies: get<boolean>('fingerprintAllow3pCookies'),
    platform: get<'windows' | 'macos' | 'linux'>('platform'),
    platformVersion: get<string>('platformVersion'),
    brand: get<string>('brand'),
    brandVersion: get<string>('brandVersion'),
    gpuVendor: get<string>('gpuVendor'),
    gpuRenderer: get<string>('gpuRenderer'),
    hardwareConcurrency: get<string>('hardwareConcurrency'),
    deviceMemory: get<string>('deviceMemory'),
    screen: get<string>('screen'),
    webrtcIp: get<string>('webrtcIp'),
    humanize: get<boolean>('humanize'),
    humanizePreset: get<string>('humanizePreset'),
    humanizeConfig: get<string>('humanizeConfig'),
    licenseKey: get<string>('licenseKey'),
    browserVersion: get<string>('browserVersion'),
    storageState: get<string>('storageState'),
    extraHeaders: get<string>('extraHeaders'),
    permissions: get<string>('permissions'),
    extensions: get<string[]>('extension'),
    extraArgs: get<string>('extraArgs'),
    slowMo: get<string>('slowMo'),
    timeout: get<string>('timeout'),
  };
}
