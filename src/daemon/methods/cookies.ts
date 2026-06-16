import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { getDefaultContext } from '../../browser.js';
import { optStr, reqStr } from './params.js';

async function ctxOf(reg: import('../registry.js').Registry, sid: string) {
  const rec = reg.requireSession(sid);
  return getDefaultContext(rec.handle);
}

export const cookiesMethods: Record<string, MethodFn> = {
  'cookies.get': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const url = optStr(params, 'url');
    const c = await ctxOf(ctx.registry, sid);
    const cookies = url ? await c.cookies(url) : await c.cookies();
    return { cookies };
  },

  'cookies.set': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const cookies = params.cookies;
    if (!Array.isArray(cookies)) throw new CloakError('INVALID_ARG', 'cookies must be an array');
    const c = await ctxOf(ctx.registry, sid);
    await c.addCookies(cookies);
    return { added: cookies.length };
  },

  'cookies.clear': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const c = await ctxOf(ctx.registry, sid);
    await c.clearCookies();
    return { cleared: true };
  },
};
