import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, optNum, optBool, reqStr, resolveUid } from './params.js';

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
    return { clicked: rawSel };
  },

  'page.dblclick': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dblclick(sel, commonClickOpts(params));
    return { dblclicked: rawSel };
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
    return { filled: rawSel };
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
    return { typed: rawSel };
  },

  'page.press': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const key = reqStr(params, 'key');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const rawSel = optStr(params, 'selector');
    const sel = rawSel ? resolveUid(rawSel) : undefined;
    if (sel) {
      // page.press goes via locator
      const locOpts: Record<string, unknown> = {};
      if (optNum(params, 'delay') !== undefined) locOpts.delay = optNum(params, 'delay');
      // Use evaluate fallback if no direct press: cloakbrowser uses Playwright so page.press exists
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
    return { pressed: key };
  },

  'page.hover': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.hover(sel);
    return { hovered: rawSel };
  },

  'page.focus': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.focus(sel);
    return { focused: rawSel };
  },

  'page.blur': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(`(sel) => { const el = document.querySelector(sel); if (el && 'blur' in el) el.blur(); }`, sel);
    return { blurred: rawSel };
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
    return { scrolled: true };
  },

  'page.select': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const values = params.values;
    const result = await ref.page.selectOption(sel, values as unknown);
    return { selected: result };
  },

  'page.check': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.check(sel);
    return { checked: rawSel };
  },

  'page.uncheck': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.uncheck(sel);
    return { unchecked: rawSel };
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
    return { uploaded: files.length };
  },

  'page.drag': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawFrom = reqStr(params, 'from');
    const rawTo = reqStr(params, 'to');
    const from = resolveUid(rawFrom);
    const to = resolveUid(rawTo);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dragAndDrop(from, to);
    return { dragged: { from: rawFrom, to: rawTo } };
  },

  'page.dispatch_event': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawSel = reqStr(params, 'selector');
    const sel = resolveUid(rawSel);
    const type = reqStr(params, 'event_type');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.dispatchEvent(sel, type, params.event_init);
    return { dispatched: type };
  },
};
