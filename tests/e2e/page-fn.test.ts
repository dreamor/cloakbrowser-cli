import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnDetached, stopDaemon, status } from '../../src/daemon/lifecycle.js';
import { getClient } from '../../src/client.js';
import { oneShotScrape } from '../../src/one-shot.js';

const HAS_BINARY = process.env.CLOAK_BINARY_READY === '1';
const PAGE = 'data:text/html,<h1 id="t">hello</h1><p class="x">world</p><p class="x">again</p>';

// Regression coverage for the class of bug where a browser-side snippet is
// passed to page.evaluate()/waitForFunction() as a STRING alongside a data
// `arg`. Playwright only binds `arg` to a real Function's parameter; a
// string is evaluated as a bare expression and `arg` is silently dropped
// (or, if the string happens to look like a function, the *unevaluated*
// function value comes back instead of calling it — no error, just wrong
// data). Mocked `page.evaluate()` in unit tests can't catch this since a
// mock doesn't replicate Playwright's real string-vs-function handling, so
// this needs a real browser.
describe.skipIf(!HAS_BINARY)('page.evaluate/waitForFunction string+arg regression (requires CLOAK_BINARY_READY=1)', () => {
  beforeAll(async () => {
    if (status().running) await stopDaemon();
    await spawnDetached();
  }, 30_000);

  afterAll(async () => {
    try { getClient().close(); } catch { /* */ }
    await stopDaemon();
  });

  it('oneShotScrape actually extracts matches instead of crashing on undefined', async () => {
    const result = await oneShotScrape(PAGE, { selector: '.x', multi: true });
    expect(result.count).toBe(2);
    expect(result.items.map((i) => i.text)).toEqual(['world', 'again']);
  }, 30_000);

  it('page.eval with --arg-equivalent binds arg for a plain expression', async () => {
    await getClient().call('daemon.ping'); // ensure connected
    const { session_id, page_id } = (await getClient().call('session.new', {})) as { session_id: string; page_id: string };
    try {
      await getClient().call('page.goto', { session_id, page_id, url: PAGE });
      const { value } = (await getClient().call('page.eval', {
        session_id, page_id,
        expression: 'arg.n * 2',
        arg: { n: 21 },
      })) as { value: number };
      expect(value).toBe(42);

      const { value: value2 } = (await getClient().call('page.eval', {
        session_id, page_id,
        expression: '(a) => document.querySelector(a.sel).textContent',
        arg: { sel: '#t' },
      })) as { value: string };
      expect(value2).toBe('hello');
    } finally {
      await getClient().call('session.close', { session_id });
    }
  }, 30_000);

  it('local_storage.set actually calls setItem (was a silent no-op)', async () => {
    // localStorage is disabled for opaque-origin data: URLs, so this one
    // needs a real http(s) origin.
    const { session_id, page_id } = (await getClient().call('session.new', {})) as { session_id: string; page_id: string };
    try {
      await getClient().call('page.goto', { session_id, page_id, url: 'https://example.com' });
      await getClient().call('local_storage.set', { session_id, page_id, key: 'k', value: 'v' });
      const { local_storage } = (await getClient().call('local_storage.get', { session_id, page_id })) as { local_storage: Record<string, string> };
      expect(local_storage.k).toBe('v');
    } finally {
      await getClient().call('session.close', { session_id });
    }
  }, 30_000);

  it('page.scroll to x/y actually scrolls (was a silent no-op)', async () => {
    const longPage = 'data:text/html,<div style="height:5000px">x</div>';
    const { session_id, page_id } = (await getClient().call('session.new', {})) as { session_id: string; page_id: string };
    try {
      await getClient().call('page.goto', { session_id, page_id, url: longPage });
      await getClient().call('page.scroll', { session_id, page_id, y: 500 });
      const { value: scrollY } = (await getClient().call('page.eval', {
        session_id, page_id, expression: 'window.scrollY',
      })) as { value: number };
      expect(scrollY).toBe(500);
    } finally {
      await getClient().call('session.close', { session_id });
    }
  }, 30_000);

  it('wait --stable resolves with a real stability result (was ReferenceError: arg is not defined)', async () => {
    const { session_id, page_id } = (await getClient().call('session.new', {})) as { session_id: string; page_id: string };
    try {
      await getClient().call('page.goto', { session_id, page_id, url: PAGE });
      const result = (await getClient().call('page.wait', {
        session_id, page_id, stable: true, quiet_ms: 100, timeout: 5000,
      })) as { waited: string; result: { stable: boolean } };
      expect(result.waited).toBe('stable');
      expect(result.result.stable).toBe(true);
    } finally {
      await getClient().call('session.close', { session_id });
    }
  }, 30_000);

  it('wait --text actually checks the page instead of resolving immediately on a function value', async () => {
    const { session_id, page_id } = (await getClient().call('session.new', {})) as { session_id: string; page_id: string };
    try {
      await getClient().call('page.goto', { session_id, page_id, url: PAGE });
      await expect(
        getClient().call('page.wait', { session_id, page_id, text: 'this text does not exist', timeout: 800 })
      ).rejects.toMatchObject({ code: 'TIMEOUT' });

      const result = await getClient().call('page.wait', { session_id, page_id, text: 'hello', timeout: 3000 });
      expect(result).toMatchObject({ waited: 'text', text: 'hello' });
    } finally {
      await getClient().call('session.close', { session_id });
    }
  }, 30_000);
});
