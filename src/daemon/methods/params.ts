import { CloakError } from '../../errors.js';

export type SnapshotItem = {
  uid: string;
  role: string;
  tag: string;
  name: string;
  bbox?: { x: number; y: number; w: number; h: number };
  selector?: string;
  attrs?: Record<string, unknown>;
  /** Set by the iframe snapshot script: "main" or frame index string */
  origin?: string;
};

export type SnapshotFilterOpts = {
  compact?: boolean;
  limit?: number;
  /** Only include elements whose bbox.y is within the viewport */
  viewportOnly?: boolean;
  /** Viewport height in px (required when viewportOnly is true for effective filtering) */
  viewportHeight?: number;
  /** Filter by attribute: "role=<value>", "tag=<value>", or "name=<substring>" */
  filter?: string;
  /** Return only the element matching this exact uid */
  uid?: string;
};

/** Extract optional string param or return undefined */
export const optStr = (p: Record<string, unknown>, k: string): string | undefined =>
  typeof p[k] === 'string' && p[k] ? (p[k] as string) : undefined;

/** Extract optional number param or return undefined */
export const optNum = (p: Record<string, unknown>, k: string): number | undefined =>
  typeof p[k] === 'number' ? (p[k] as number) : undefined;

/** Extract optional boolean param or return undefined */
export const optBool = (p: Record<string, unknown>, k: string): boolean | undefined =>
  typeof p[k] === 'boolean' ? (p[k] as boolean) : undefined;

/** Extract required string param or throw INVALID_ARG */
export function reqStr(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  if (typeof v !== 'string' || !v) throw new CloakError('INVALID_ARG', `Missing required: ${k}`);
  return v;
}

/**
 * If the given string looks like a cloak uid (e.g. "u7", "u123"), convert it
 * to a CSS selector targeting the `data-cloak-uid` attribute so it can be
 * passed directly to Playwright locators. Otherwise pass through unchanged.
 */
export function resolveUid(sel: string): string {
  if (/^u\d+$/.test(sel)) return `[data-cloak-uid="${sel}"]`;
  return sel;
}

/**
 * Post-process a snapshot result: apply compact (strip bbox/selector), viewportOnly,
 * filter by role/tag/name, uid, and/or limit.
 * Filters are applied in order: compact → viewportOnly → filter → uid → limit
 * @returns The filtered items array.
 */
export function filterSnapshot(
  snapshot: { items: SnapshotItem[]; url: string; title: string },
  opts: SnapshotFilterOpts,
): SnapshotItem[] {
  let items = snapshot.items;

  if (opts.compact) {
    items = items.map(({ bbox: _b, selector: _s, ...rest }) => rest);
  }

  if (opts.viewportOnly && opts.viewportHeight !== undefined) {
    const vh = opts.viewportHeight;
    items = items.filter(i => i.bbox && i.bbox.y < vh);
  }

  if (opts.filter) {
    const eqIdx = opts.filter.indexOf('=');
    if (eqIdx > 0) {
      const key = opts.filter.slice(0, eqIdx);
      const val = opts.filter.slice(eqIdx + 1);
      if (key === 'role') {
        items = items.filter(i => i.role === val);
      } else if (key === 'tag') {
        items = items.filter(i => i.tag === val);
      } else if (key === 'name') {
        items = items.filter(i => i.name.includes(val));
      }
    }
  }

  if (opts.uid) {
    items = items.filter(i => i.uid === opts.uid);
  }

  if (opts.limit !== undefined && opts.limit >= 0 && opts.limit < items.length) {
    items = items.slice(0, opts.limit);
  }

  return items;
}

/**
 * In-page script that tags interactive elements with `data-cloak-uid` and
 * returns a flat snapshot of visible elements: uid, role, tag, name, attrs,
 * bounding box, and selector.
 *
 * Used by both `page.snapshot` and `maybeSnapshot` (after-action snapshots)
 * to keep element tagging logic in a single definition.
 */
export const SNAPSHOT_TAGGER_SCRIPT = `(() => {
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
      uid, role, tag, name,
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
})()`;

/**
 * In-page script that tags interactive + content elements within the main document
 * AND all same-origin iframes with `data-cloak-uid`, then returns a flat snapshot
 * of visible elements. Each element includes an `origin` field set to `"main"` or
 * the iframe's index as a string for disambiguation.
 */
export const SNAPSHOT_IFRAME_SCRIPT = `(() => {
  const TAGS = ['a','button','input','textarea','select','label','summary','details','option','[role=button]','[role=link]','[role=textbox]','[role=combobox]','[role=checkbox]','[role=radio]','[role=tab]','[role=menuitem]','[role=switch]','[role=slider]'];
  const sel = TAGS.join(',');
  let counter = 0;
  const items = [];
  function scan(root, origin) {
    const els = Array.from(root.querySelectorAll(sel));
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
        uid, role, tag, name, origin,
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
  }
  scan(document, 'main');
  const frames = Array.from(document.querySelectorAll('iframe'));
  for (let i = 0; i < frames.length; i++) {
    try {
      const doc = frames[i].contentDocument;
      if (doc) scan(doc, String(i));
    } catch { /* cross-origin iframe — skip silently */ }
  }
  return { items, url: location.href, title: document.title };
})()`;