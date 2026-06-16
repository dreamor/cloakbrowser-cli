import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { maybeFileOrBase64 } from '../../output.js';
import { htmlToMarkdown } from '../../utils/markdown.js';
import { optStr, optBool, optNum, reqStr } from './params.js';

export const contentMethods: Record<string, MethodFn> = {
  'page.content': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return { html: await ref.page.content(), url: ref.page.url() };
  },

  'page.text': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const sel = optStr(params, 'selector');
    const text = sel
      ? await ref.page.innerText(sel)
      : ((await ref.page.evaluate('document.body && document.body.innerText || ""')) as string);
    return { text, url: ref.page.url() };
  },

  'page.html': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const sel = reqStr(params, 'selector');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return { html: await ref.page.innerHTML(sel), selector: sel };
  },

  'page.attr': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const sel = reqStr(params, 'selector');
    const name = reqStr(params, 'name');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return { value: await ref.page.getAttribute(sel, name) };
  },

  'page.markdown': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const html = await ref.page.content();
    return htmlToMarkdown(html, ref.page.url());
  },

  'page.screenshot': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const sel = optStr(params, 'selector');
    const opts: Record<string, unknown> = {};
    if (optBool(params, 'full_page') !== undefined) opts.fullPage = optBool(params, 'full_page');
    if (optStr(params, 'format')) opts.type = optStr(params, 'format');
    if (optNum(params, 'quality') !== undefined) opts.quality = optNum(params, 'quality');

    let buf: Buffer;
    if (sel) {
      const handle = (await ref.page.waitForSelector(sel, { state: 'visible' })) as null | {
        screenshot: (o?: unknown) => Promise<Buffer>;
      };
      if (!handle) throw new CloakError('SELECTOR_NOT_FOUND', `Selector not found: ${sel}`);
      buf = await handle.screenshot(opts);
    } else {
      buf = (await ref.page.screenshot(opts)) as Buffer;
    }
    return maybeFileOrBase64(buf, optStr(params, 'path'));
  },

  'page.pdf': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const opts: Record<string, unknown> = {};
    if (optStr(params, 'format')) opts.format = optStr(params, 'format');
    if (optBool(params, 'landscape') !== undefined) opts.landscape = optBool(params, 'landscape');
    const buf = (await ref.page.pdf(opts)) as Buffer;
    return maybeFileOrBase64(buf, optStr(params, 'path'));
  },
};
