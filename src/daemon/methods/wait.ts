import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, optNum, reqStr } from './params.js';

export const waitMethods: Record<string, MethodFn> = {
  'page.wait': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const timeout = optNum(params, 'timeout');
    const selector = optStr(params, 'selector');
    const text = optStr(params, 'text');
    const urlPat = optStr(params, 'url');
    const loadState = optStr(params, 'load_state');
    const state = optStr(params, 'state');

    if (selector) {
      const opts: Record<string, unknown> = {};
      if (state) opts.state = state;
      if (timeout !== undefined) opts.timeout = timeout;
      await ref.page.waitForSelector(selector, opts);
      return { waited: 'selector', selector };
    }
    if (text) {
      const opts: Record<string, unknown> = {};
      if (timeout !== undefined) opts.timeout = timeout;
      await ref.page.waitForFunction(
        `(t) => document.body && document.body.innerText && document.body.innerText.includes(t)`,
        text,
        opts
      );
      return { waited: 'text', text };
    }
    if (urlPat) {
      const opts: Record<string, unknown> = {};
      if (timeout !== undefined) opts.timeout = timeout;
      await ref.page.waitForURL(urlPat, opts);
      return { waited: 'url', url: urlPat };
    }
    if (loadState) {
      const opts: Record<string, unknown> = {};
      if (timeout !== undefined) opts.timeout = timeout;
      await ref.page.waitForLoadState(loadState, opts);
      return { waited: 'load_state', state: loadState };
    }
    throw new CloakError('INVALID_ARG', 'wait requires one of: selector, text, url, load_state');
  },

  'page.sleep': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ms = optNum(params, 'ms');
    if (ms === undefined) throw new CloakError('INVALID_ARG', 'ms is required');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.waitForTimeout(ms);
    return { slept_ms: ms };
  },
};
