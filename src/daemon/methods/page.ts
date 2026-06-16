import type { MethodCtx, MethodFn } from './index.js';
import { getDefaultContext } from '../../browser.js';
import { reqStr } from './params.js';

export const pageMethods: Record<string, MethodFn> = {
  'page.new': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rec = ctx.registry.requireSession(sid);
    const target = getOrMakeContext(rec.handle);
    const ctxObj = await target;
    const page = await ctxObj.newPage();
    const pageId = ctx.registry.registerPage(sid, page);
    return { page_id: pageId, url: page.url() };
  },

  'page.list': (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const desc = ctx.registry.describeSession(sid);
    return desc.pages;
  },

  'page.close': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const pid = reqStr(params, 'page_id');
    const ref = ctx.registry.requirePage(sid, pid);
    await ref.page.close();
    return { closed: true };
  },

  'page.activate': (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const pid = reqStr(params, 'page_id');
    ctx.registry.setActivePage(sid, pid);
    return { active_page: pid };
  },
};

async function getOrMakeContext(handle: import('../../browser.js').LaunchedHandle): Promise<import('../../browser.js').AnyContext> {
  return getDefaultContext(handle);
}
