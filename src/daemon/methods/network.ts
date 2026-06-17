import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { getDefaultContext } from '../../browser.js';
import { optStr, reqStr } from './params.js';

export const networkMethods: Record<string, MethodFn> = {
  'network.request': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const url = reqStr(params, 'url');
    const rec = ctx.registry.requireSession(sid);
    const c = await getDefaultContext(rec.handle);

    const opts: Record<string, unknown> = {};
    if (optStr(params, 'method')) opts.method = optStr(params, 'method');
    if (params.headers && typeof params.headers === 'object') opts.headers = params.headers;
    if (params.body !== undefined) opts.data = params.body;
    if (params.form && typeof params.form === 'object') opts.form = params.form;
    if (params.multipart && typeof params.multipart === 'object') opts.multipart = params.multipart;
    if (typeof params.timeout === 'number') opts.timeout = params.timeout;

    const resp = await c.request.fetch(url, opts);
    const status = resp.status();
    const headers = resp.headers();
    let body: string;
    let json: unknown = undefined;
    const ct = headers['content-type'] ?? '';
    if (ct.includes('application/json')) {
      try {
        json = await resp.json();
        body = JSON.stringify(json);
      } catch {
        body = await resp.text();
      }
    } else {
      body = await resp.text();
    }
    return {
      url: resp.url(),
      status,
      status_text: resp.statusText(),
      ok: resp.ok(),
      headers,
      body,
      ...(json !== undefined ? { json } : {}),
    };
  },

  'network.recent': async (params, ctx: MethodCtx) => {
    void params;
    void ctx;
    return {
      requests: [],
      note: 'network.recent is not implemented yet; use page.eval with performance.getEntriesByType("resource") for a snapshot',
    };
  },
};
