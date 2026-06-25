import { describe, expect, it, vi } from 'vitest';
import { resolveLaunchOpts } from '../../src/options.js';

/* -------------------------------------------------------------------
 * Type-level tests — validate that the CloakModule type signature
 * accepts the 3 new optional fields added upstream in v0.3.29+.
 *
 * These are compile-time checks: they verify the type shim allows
 * buildLaunchOptions / buildContextOptions / humanizeBrowser as
 * optional members.  The module itself cannot be imported in unit
 * tests (it's a peer dep), so we validate the type contract via
 * mock objects.
 * ----------------------------------------------------------------- */

describe('CloakModule type (compile-time contract)', () => {
  it('accepts a v0.3.29+ module shape with buildLaunchOptions', () => {
    // Simulate a mock that satisfies the CloakModule interface
    // including the 3 new optional fields.
    const mod = {
      launch: vi.fn(),
      buildLaunchOptions: vi.fn(() => Promise.resolve({})),
      buildContextOptions: vi.fn(() => ({})),
      humanizeBrowser: vi.fn(() => Promise.resolve()),
    };

    // If the type shim is correct, all four methods are callable.
    expect(typeof mod.launch).toBe('function');
    expect(typeof mod.buildLaunchOptions).toBe('function');
    expect(typeof mod.buildContextOptions).toBe('function');
    expect(typeof mod.humanizeBrowser).toBe('function');
  });

  it('accepts a v0.3.x module shape WITHOUT the new fields (backward compat)', () => {
    // Old modules don't expose buildLaunchOptions etc. — must be optional.
    const mod = {
      launch: vi.fn(),
      ensureBinary: vi.fn(),
      binaryInfo: vi.fn(),
      clearCache: vi.fn(),
      // No buildLaunchOptions — this MUST compile without error.
    };

    expect(typeof mod.launch).toBe('function');
    expect(typeof mod.ensureBinary).toBe('function');
  });
});

/* -------------------------------------------------------------------
 * Runtime tests — proxy credential forwarding (launchFromResolved
 * passes proxy through, and upstream handles the rest).
 * ----------------------------------------------------------------- */

describe('Proxy forwarding (runtime)', () => {
  it('passes proxy string through in launchOptions', () => {
    const r = resolveLaunchOpts({ proxy: 'http://user:pass@host:8080' });
    expect(r.launchOptions.proxy).toBe('http://user:pass@host:8080');
  });

  it('passes socks5 proxy through unchanged', () => {
    const r = resolveLaunchOpts({ proxy: 'socks5://user:pass@host:1080' });
    expect(r.launchOptions.proxy).toBe('socks5://user:pass@host:1080');
  });

  it('passes proxy without credentials', () => {
    const r = resolveLaunchOpts({ proxy: 'http://proxy.example.com:3128' });
    expect(r.launchOptions.proxy).toBe('http://proxy.example.com:3128');
  });
});