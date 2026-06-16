import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, reqStr } from './params.js';

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

    // Tag interactive elements
    const tagged = (await ref.page.evaluate(
      `(() => {
        const TAGS = ['a','button','input','textarea','select','label','summary','details','option','[role=button]','[role=link]','[role=textbox]','[role=combobox]','[role=checkbox]','[role=radio]','[role=tab]','[role=menuitem]','[role=switch]','[role=slider]'];
        const sel = TAGS.join(',');
        const els = Array.from(document.querySelectorAll(sel));
        let counter = 0;
        const items = [];
        for (const el of els) {
          counter += 1;
          const uid = 'u' + counter;
          el.setAttribute('data-cloak-uid', uid);
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || tag;
          let name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('value') || '').trim();
          if (name.length > 120) name = name.slice(0, 120) + '…';
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
          if (!visible) continue;
          items.push({
            uid,
            role,
            tag,
            name,
            attrs: {
              id: el.id || null,
              name: el.getAttribute('name') || null,
              type: el.getAttribute('type') || null,
              href: el.getAttribute('href') || null,
              placeholder: el.getAttribute('placeholder') || null,
              value: ('value' in el && el.value) ? String(el.value).slice(0, 200) : null,
              disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
              checked: 'checked' in el ? !!el.checked : (el.getAttribute('aria-checked') === 'true'),
            },
            bbox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            selector: '[data-cloak-uid="' + uid + '"]',
          });
        }
        return { items, url: location.href, title: document.title };
      })()`
    )) as { items: unknown[]; url: string; title: string };

    return {
      url: tagged.url,
      title: tagged.title,
      count: tagged.items.length,
      elements: tagged.items,
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
