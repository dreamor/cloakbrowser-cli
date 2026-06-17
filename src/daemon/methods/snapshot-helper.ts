import type { PageRef } from '../registry.js';

/**
 * If the caller requested an after-action snapshot, run the snapshot
 * and attach it to the result. Returns the result augmented with
 * `snapshot` if requested, or the result unchanged otherwise.
 */
export async function maybeSnapshot<T extends Record<string, unknown>>(
  result: T,
  ref: PageRef,
  params: Record<string, unknown>,
): Promise<T & { snapshot?: unknown }> {
  if (!params.want_snapshot) return result;

  try {
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
      })()`
    )) as { items: unknown[]; url: string; title: string };

    return { ...result, snapshot: tagged };
  } catch {
    // Snapshot is best-effort; don't fail the operation
    return result;
  }
}