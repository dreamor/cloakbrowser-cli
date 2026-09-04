import { describe, it, expect } from 'vitest';
import { rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { launchFromResolved, getPageOrCreate } from '../../src/browser.js';
import { resolveLaunchOpts } from '../../src/options.js';

const HAS_BINARY = process.env.CLOAK_BINARY_READY === '1';

// Regression coverage for the class of bug where cloakbrowser's
// LaunchOptions/LaunchContextOptions only define a fixed top-level field
// set — options that are real Playwright launch()/newContext() options but
// aren't in that interface (extraHTTPHeaders, storageState, permissions,
// slowMo, timeout, channel) are silently dropped unless nested under
// `contextOptions`/`launchOptions`. Confirmed empirically against real
// cloakbrowser 0.5.10 before fixing options.ts to nest them.
describe.skipIf(!HAS_BINARY)('launch option nesting (requires CLOAK_BINARY_READY=1)', () => {
  it('--persistent no longer crashes with "path must be a string"', async () => {
    const dir = '/tmp/cloak-e2e-persist-test';
    rmSync(dir, { recursive: true, force: true });
    const resolved = resolveLaunchOpts({ persistent: dir, headless: true });
    const handle = await launchFromResolved(resolved);
    try {
      expect(handle.kind).toBe('context');
    } finally {
      await handle.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('--extra-headers is actually sent to the server', async () => {
    const resolved = resolveLaunchOpts({ extraHeaders: '{"X-Cloak-Test":"present"}', headless: true });
    const handle = await launchFromResolved(resolved);
    try {
      const page = await getPageOrCreate(handle);
      await page.goto('https://httpbin.org/headers', { timeout: 15_000 });
      const body = (await page.evaluate('document.body.innerText')) as string;
      expect(body.toLowerCase()).toContain('x-cloak-test');
    } finally {
      await handle.close();
    }
  }, 30_000);

  it('--storage-state actually restores cookies at launch', async () => {
    const path = '/tmp/cloak-e2e-state.json';
    writeFileSync(path, JSON.stringify({
      cookies: [{ name: 'e2eresume', value: 'yes', domain: 'example.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }],
      origins: [],
    }));
    const resolved = resolveLaunchOpts({ storageState: path, headless: true });
    const handle = await launchFromResolved(resolved);
    try {
      expect(handle.kind).toBe('context');
      if (handle.kind === 'context') {
        const cookies = await handle.context.cookies();
        expect(cookies.some((c) => (c as { name: string }).name === 'e2eresume')).toBe(true);
      }
    } finally {
      await handle.close();
      unlinkSync(path);
    }
  }, 30_000);

  it('--slow-mo actually delays actions instead of being a no-op', async () => {
    const resolved = resolveLaunchOpts({ slowMo: '1200', headless: true });
    const handle = await launchFromResolved(resolved);
    try {
      const page = await getPageOrCreate(handle);
      await page.goto('data:text/html,<button id="b">go</button>');
      const t0 = Date.now();
      await page.click('#b');
      expect(Date.now() - t0).toBeGreaterThan(800);
    } finally {
      await handle.close();
    }
  }, 30_000);
});
