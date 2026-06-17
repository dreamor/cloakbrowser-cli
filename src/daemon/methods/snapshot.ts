import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, reqStr, SNAPSHOT_TAGGER_SCRIPT, SNAPSHOT_IFRAME_SCRIPT, filterSnapshot, type SnapshotItem, type SnapshotFilterOpts } from './params.js';

/**
 * Build a simplified snapshot of the page, similar to Playwright's accessibility tree
 * plus per-element uids so an agent can target elements without crafting selectors.
 *
 * Strategy: tag interactive + content elements with data-cloak-uid in-page,
 * then walk the a11y tree and produce a flat list { uid, role, name, selector }.
 */
export const snapshotMethods: Record<string, MethodFn> = {
  'page.snapshot': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));

    // Tag interactive elements — use iframe-aware script when frames requested
    const script = params.frames ? SNAPSHOT_IFRAME_SCRIPT : SNAPSHOT_TAGGER_SCRIPT;
    const tagged = (await ref.page.evaluate(
      script
    )) as { items: Record<string, unknown>[]; url: string; title: string };

    const filterOpts: SnapshotFilterOpts = {};
    if (params.compact === true) filterOpts.compact = true;
    if (typeof params.limit === 'number') filterOpts.limit = params.limit;
    if (typeof params.viewport_only === 'boolean') {
      filterOpts.viewportOnly = params.viewport_only;
      filterOpts.viewportHeight = typeof params.viewport_height === 'number'
        ? params.viewport_height
        : undefined;
    }
    if (typeof params.filter === 'string') filterOpts.filter = params.filter;
    if (typeof params.uid === 'string' && params.uid) filterOpts.uid = params.uid;

    const filtered = filterSnapshot(
      { items: tagged.items as SnapshotItem[], url: tagged.url, title: tagged.title },
      filterOpts,
    );

    return {
      url: tagged.url,
      title: tagged.title,
      count: filtered.length,
      total: tagged.items.length,
      elements: filtered,
    };
  },

  'page.frames': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const frames = ref.page.frames();
    return {
      count: frames.length,
      frames: frames.map((f, i) => ({ index: i, url: f.url(), name: f.name() })),
    };
  },

  'page.accessibility': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const a11y = ref.page.accessibility;
    if (!a11y || typeof a11y.snapshot !== 'function') {
      throw new CloakError(
        'UNSUPPORTED_OPERATION',
        'page.accessibility is not available in this browser/context. ' +
        'Try using "cloak snapshot" instead, which provides a similar element tree via DOM inspection.'
      );
    }
    const tree = await a11y.snapshot({ interestingOnly: true });
    return { tree };
  },
};
