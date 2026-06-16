import type { MethodCtx, MethodFn } from './index.js';
import { optStr, reqStr } from './params.js';

function navOpts(params: Record<string, unknown>): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (typeof params.wait_until === 'string') opts.waitUntil = params.wait_until;
  if (typeof params.timeout === 'number') opts.timeout = params.timeout;
  if (typeof params.referer === 'string') opts.referer = params.referer;
  return opts;
}

export const navigationMethods: Record<string, MethodFn> = {
  'page.goto': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const url = reqStr(params, 'url');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const resp = (await ref.page.goto(url, navOpts(params))) as null | {
      status: () => number;
      statusText: () => string;
      url: () => string;
    };
    return {
      url: ref.page.url(),
      title: await ref.page.title(),
      status: resp ? resp.status() : null,
      status_text: resp ? resp.statusText() : null,
    };
  },

  'page.back': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.goBack(navOpts(params));
    return { url: ref.page.url() };
  },

  'page.forward': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.goForward(navOpts(params));
    return { url: ref.page.url() };
  },

  'page.reload': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.reload(navOpts(params));
    return { url: ref.page.url() };
  },

  'page.url': (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return { url: ref.page.url() };
  },

  'page.title': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return { title: await ref.page.title() };
  },
};
