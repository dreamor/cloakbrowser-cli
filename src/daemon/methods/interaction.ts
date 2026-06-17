import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, optNum, optBool, reqStr, resolveUid } from './params.js';
import { maybeSnapshot } from './snapshot-helper.js';

function commonClickOpts(p: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (optStr(p, 'button')) o.button = optStr(p, 'button');
  if (optNum(p, 'click_count') !== undefined) o.clickCount = optNum(p, 'click_count');
  if (optBool(p, 'force') !== undefined) o.force = optBool(p, 'force');
  if (optNum(p, 'timeout') !== undefined) o.timeout = optNum(p, 'timeout');
  if (optNum(p, 'delay') !== undefined) o.delay = optNum(p, 'delay');
  if (Array.isArray(p.modifiers)) o.modifiers = p.modifiers;
  if (optNum(p, 'position_x') !== undefined && optNum(p, 'position_y') !== undefined) {
    o.position = { x: optNum(p, 'position_x'), y: optNum(p, 'position_y') };
  }
  return o;
}

export const interactionMethods: Record<string, MethodFn> = {
  'page.click': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.click(sel, commonClickOpts(params));
    return maybeSnapshot({ clicked: rawSel }, ref, params);
  },

  'page.dblclick': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dblclick(sel, commonClickOpts(params));
    return maybeSnapshot({ dblclicked: rawSel }, ref, params);
  },

  'page.fill': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const value = reqStr(params, 'value');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const opts: Record<string, unknown> = {};
    if (optNum(params, 'timeout') !== undefined) opts.timeout = optNum(params, 'timeout');
    if (optBool(params, 'force') !== undefined) opts.force = optBool(params, 'force');
    await ref.page.fill(sel, value, opts);
    return maybeSnapshot({ filled: rawSel }, ref, params);
  },

  'page.type': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const text = reqStr(params, 'text');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const opts: Record<string, unknown> = {};
    if (optNum(params, 'delay') !== undefined) opts.delay = optNum(params, 'delay');
    await ref.page.type(sel, text, opts);
    return maybeSnapshot({ typed: rawSel }, ref, params);
  },

  'page.press': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const key = reqStr(params, 'key');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const rawSel = optStr(params, 'selector');
    const sel = rawSel ? resolveUid(rawSel) : undefined;
    if (sel) {
      const locOpts: Record<string, unknown> = {};
      if (optNum(params, 'delay') !== undefined) locOpts.delay = optNum(params, 'delay');
      const pressMaybe = (ref.page as unknown as { press?: (s: string, k: string, o?: unknown) => Promise<void> }).press;
      if (typeof pressMaybe === 'function') {
        await pressMaybe.call(ref.page, sel, key, locOpts);
      } else {
        await ref.page.focus(sel);
        await ref.page.keyboard.press(key, locOpts);
      }
    } else {
      await ref.page.keyboard.press(key);
    }
    return maybeSnapshot({ pressed: key }, ref, params);
  },

  'page.hover': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.hover(sel);
    return maybeSnapshot({ hovered: rawSel }, ref, params);
  },

  'page.focus': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.focus(sel);
    return maybeSnapshot({ focused: rawSel }, ref, params);
  },

  'page.blur': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(`(sel) => { const el = document.querySelector(sel); if (el && 'blur' in el) el.blur(); }`, sel);
    return maybeSnapshot({ blurred: rawSel }, ref, params);
  },

  'page.scroll': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const rawTo = optStr(params, 'to');
    const to = rawTo ? resolveUid(rawTo) : undefined;
    const x = optNum(params, 'x');
    const y = optNum(params, 'y');
    if (to === 'top') {
      await ref.page.evaluate('window.scrollTo(0, 0)');
    } else if (to === 'bottom') {
      await ref.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    } else if (to) {
      await ref.page.evaluate(
        `(sel) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({behavior:'smooth', block:'center'}); }`,
        to
      );
    } else if (x !== undefined || y !== undefined) {
      await ref.page.evaluate(`(coord) => window.scrollTo(coord.x, coord.y)`, { x: x ?? 0, y: y ?? 0 });
    }
    return maybeSnapshot({ scrolled: true }, ref, params);
  },

  'page.select': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const values = params.values;
    const result = await ref.page.selectOption(sel, values as unknown);
    return maybeSnapshot({ selected: result }, ref, params);
  },

  'page.check': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.check(sel);
    return maybeSnapshot({ checked: rawSel }, ref, params);
  },

  'page.uncheck': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.uncheck(sel);
    return maybeSnapshot({ unchecked: rawSel }, ref, params);
  },

  'page.upload': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const files = params.files;
    if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) {
      throw new CloakError('INVALID_ARG', 'files must be an array of paths');
    }
    await ref.page.setInputFiles(sel, files);
    return maybeSnapshot({ uploaded: files.length }, ref, params);
  },

  'page.drag': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawFrom = reqStr(params, 'from');
    const rawTo = reqStr(params, 'to');
    const from = resolveUid(rawFrom);
    const to = resolveUid(rawTo);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dragAndDrop(from, to);
    return maybeSnapshot({ dragged: { from: rawFrom, to: rawTo } }, ref, params);
  },

  'page.dispatch_event': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const type = reqStr(params, 'event_type');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dispatchEvent(sel, type, params.event_init);
    return maybeSnapshot({ dispatched: type }, ref, params);
  },
};
