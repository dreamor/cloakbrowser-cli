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

  it('forwards extra-headers and permissions', () => {
    const r = resolveLaunchOpts({
      extraHeaders: '{"X-Test":"1"}',
      permissions: '["geolocation"]',
    });
    expect(r.launchOptions.extraHTTPHeaders).toEqual({ 'X-Test': '1' });
    expect(r.launchOptions.permissions).toEqual(['geolocation']);
  });

  it('maps license-key and browser-version', () => {
    const r = resolveLaunchOpts({
      licenseKey: 'sk-xxxx',
      browserVersion: '148.0.7778.215.5',
    });
    expect(r.launchOptions.licenseKey).toBe('sk-xxxx');
    expect(r.launchOptions.browserVersion).toBe('148.0.7778.215.5');
  });
});
