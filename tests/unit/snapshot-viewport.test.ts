import { describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { MethodCtx } from '../../src/daemon/methods/index.js';
import { snapshotMethods } from '../../src/daemon/methods/snapshot.js';

const tagged = {
  items: [
    { uid: 'u1', role: 'link', tag: 'a', name: 'top', bbox: { x: 0, y: 0, w: 10, h: 10 }, selector: '[data-cloak-uid="u1"]' },
    { uid: 'u2', role: 'link', tag: 'a', name: 'bot', bbox: { x: 0, y: 2000, w: 10, h: 10 }, selector: '[data-cloak-uid="u2"]' },
  ],
  url: 'https://example.com/',
  title: 't',
};

function makeCtx(liveViewportHeight: number | null): MethodCtx {
  const page = {
    evaluate: vi.fn().mockResolvedValue(tagged),
    viewportSize: vi.fn(() => liveViewportHeight === null ? null : { width: 800, height: liveViewportHeight }),
  };
  return { registry: { requirePage: () => ({ page }) } } as unknown as MethodCtx;
}

const call = (fn: unknown) => fn as (params: Record<string, unknown>, ctx: MethodCtx) => Promise<{ count: number; items: Array<Record<string, unknown>> }>;

describe('page.snapshot viewport fallback', () => {
  it('falls back to the live viewport height when --viewport-only has no explicit height', async () => {
    // Regression: used to be a silent no-op (returned both elements) unless
    // --viewport-height was also passed.
    const r = await call(snapshotMethods['page.snapshot'])({ session_id: 's-1', viewport_only: true }, makeCtx(100));
    expect(r.count).toBe(1);
    expect(r.items[0].uid).toBe('u1');
  });

  it('applies viewportOnly before compact so the combination keeps filtered items', async () => {
    // Regression: --compact --viewport-only used to return 0 items because
    // compact stripped bbox before the viewport check ran.
    const r = await call(snapshotMethods['page.snapshot'])(
      { session_id: 's-1', viewport_only: true, compact: true },
      makeCtx(100),
    );
    expect(r.count).toBe(1);
    expect(r.items[0].bbox).toBeUndefined();
    expect(r.items[0].selector).toBeUndefined();
  });

  it('prefers an explicit viewport_height over the live viewport', async () => {
    const r = await call(snapshotMethods['page.snapshot'])(
      { session_id: 's-1', viewport_only: true, viewport_height: 5000 },
      makeCtx(100),
    );
    expect(r.count).toBe(2);
  });

  it('does not filter when the page reports no viewport, but --compact alone still strips', async () => {
    const r = await call(snapshotMethods['page.snapshot'])(
      { session_id: 's-1', compact: true },
      makeCtx(null),
    );
    expect(r.count).toBe(2);
    expect(r.items[0].bbox).toBeUndefined();
  });
});
