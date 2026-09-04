import { describe, expect, it } from 'vitest';
import { resolveLaunchOpts } from '../../src/options.js';

describe('resolveLaunchOpts', () => {
  it('returns empty options when nothing is set', () => {
    const r = resolveLaunchOpts({});
    expect(r.launchOptions).toEqual({});
    expect(r.persistentDir).toBeUndefined();
    expect(r.wantsContext).toBe(false);
  });

  it('maps proxy / humanize / fingerprint flags', () => {
    const r = resolveLaunchOpts({
      proxy: 'http://x:y@host:8080',
      humanize: true,
      humanizePreset: 'careful',
      fingerprint: '12345',
      platform: 'windows',
    });
    expect(r.launchOptions.proxy).toBe('http://x:y@host:8080');
    expect(r.launchOptions.humanize).toBe(true);
    expect(r.launchOptions.humanPreset).toBe('careful');
    expect(r.launchOptions.args).toContain('--fingerprint=12345');
    expect(r.launchOptions.args).toContain('--fingerprint-platform=windows');
  });

  it('parses viewport and screen', () => {
    const r = resolveLaunchOpts({ viewport: '1920x1080', screen: '2560x1440' });
    expect(r.launchOptions.viewport).toEqual({ width: 1920, height: 1080 });
    expect(r.launchOptions.args).toContain('--fingerprint-screen-width=2560');
    expect(r.launchOptions.args).toContain('--fingerprint-screen-height=1440');
  });

  it('parses humanize-config JSON', () => {
    const r = resolveLaunchOpts({ humanize: true, humanizeConfig: '{"typing_delay":120}' });
    expect(r.launchOptions.humanConfig).toEqual({ typing_delay: 120 });
  });

  it('rejects invalid extra-args', () => {
    expect(() => resolveLaunchOpts({ extraArgs: '"not-an-array"' })).toThrow(/JSON array of strings/);
  });

  it('rejects invalid viewport', () => {
    expect(() => resolveLaunchOpts({ viewport: 'not-a-viewport' })).toThrow(/Invalid viewport/);
  });

  it('flags context-mode when context-level opts set', () => {
    expect(resolveLaunchOpts({ userAgent: 'X' }).wantsContext).toBe(true);
    expect(resolveLaunchOpts({ storageState: '/x.json' }).wantsContext).toBe(true);
    expect(resolveLaunchOpts({ extensions: ['/p'] }).wantsContext).toBe(true);
  });

  it('returns persistentDir when --persistent given', () => {
    const r = resolveLaunchOpts({ persistent: '/profile' });
    expect(r.persistentDir).toBe('/profile');
    expect(r.wantsContext).toBe(true);
  });

  it('nests extra-headers, permissions, and storage-state under contextOptions', () => {
    // cloakbrowser's LaunchContextOptions has no top-level extraHTTPHeaders/
    // permissions/storageState fields — they're silently dropped unless
    // nested under `contextOptions` (confirmed empirically against a real
    // cloakbrowser 0.5.10 launchContext() call).
    const r = resolveLaunchOpts({
      extraHeaders: '{"X-Test":"1"}',
      permissions: '["geolocation"]',
      storageState: '/tmp/state.json',
    });
    const contextOptions = r.launchOptions.contextOptions as Record<string, unknown>;
    expect(contextOptions.extraHTTPHeaders).toEqual({ 'X-Test': '1' });
    expect(contextOptions.permissions).toEqual(['geolocation']);
    expect(contextOptions.storageState).toBe('/tmp/state.json');
    expect(r.launchOptions.extraHTTPHeaders).toBeUndefined();
    expect(r.launchOptions.permissions).toBeUndefined();
    expect(r.launchOptions.storageState).toBeUndefined();
  });

  it('nests slow-mo, timeout, and channel under launchOptions (raw Playwright passthrough)', () => {
    // Same issue: cloakbrowser's LaunchOptions has no top-level slowMo/
    // timeout/channel fields. Confirmed empirically: top-level slowMo is a
    // silent no-op, nested under `launchOptions` it actually delays actions.
    const r = resolveLaunchOpts({ slowMo: '300', timeout: '5000', channel: 'chrome' });
    const nested = r.launchOptions.launchOptions as Record<string, unknown>;
    expect(nested.slowMo).toBe(300);
    expect(nested.timeout).toBe(5000);
    expect(nested.channel).toBe('chrome');
    expect(r.launchOptions.slowMo).toBeUndefined();
    expect(r.launchOptions.timeout).toBeUndefined();
    expect(r.launchOptions.channel).toBeUndefined();
  });

  it('maps license-key and browser-version', () => {
    const r = resolveLaunchOpts({
      licenseKey: 'sk-xxxx',
      browserVersion: '148.0.7778.215.5',
    });
    expect(r.launchOptions.licenseKey).toBe('sk-xxxx');
    expect(r.launchOptions.browserVersion).toBe('148.0.7778.215.5');
  });

  it('maps release-channel preview/stable', () => {
    expect(resolveLaunchOpts({ releaseChannel: 'preview' }).launchOptions.releaseChannel).toBe('preview');
    expect(resolveLaunchOpts({ releaseChannel: 'stable' }).launchOptions.releaseChannel).toBe('stable');
  });

  it('rejects invalid release-channel', () => {
    expect(() =>
      resolveLaunchOpts({ releaseChannel: 'nightly' as unknown as 'preview' })
    ).toThrow(/stable.*preview/);
  });

  it('forwards extensions as camelCase extensionPaths (not snake_case)', () => {
    const r = resolveLaunchOpts({ extensions: ['/abs/ext-a', '/abs/ext-b'] });
    expect(r.launchOptions.extensionPaths).toEqual(['/abs/ext-a', '/abs/ext-b']);
    expect(r.launchOptions.extension_paths).toBeUndefined();
  });

  it('emits --fingerprint-noise=false only when explicitly disabled', () => {
    expect(resolveLaunchOpts({ fingerprintNoise: false }).launchOptions.args).toContain(
      '--fingerprint-noise=false'
    );
    // Default / not-passed: no flag
    expect(resolveLaunchOpts({}).launchOptions.args).toBeUndefined();
    expect(resolveLaunchOpts({ fingerprintNoise: true }).launchOptions.args).toBeUndefined();
  });

  it('emits --fingerprint-allow-3p-cookies when enabled', () => {
    expect(
      resolveLaunchOpts({ fingerprintAllow3pCookies: true }).launchOptions.args
    ).toContain('--fingerprint-allow-3p-cookies');
    expect(resolveLaunchOpts({ fingerprintAllow3pCookies: false }).launchOptions.args).toBeUndefined();
  });
});
