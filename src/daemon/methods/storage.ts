import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { getDefaultContext } from '../../browser.js';
import { optStr, reqStr } from './params.js';

export const storageMethods: Record<string, MethodFn> = {
  'storage.save': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const path = reqStr(params, 'path');
    const rec = ctx.registry.requireSession(sid);
    const c = await getDefaultContext(rec.handle);
    await c.storageState({ path });
    return { path };
  },

  'storage.load': async (params, ctx: MethodCtx) => {
    // storage state is loaded at launch time. To "load" after launch we'd need a new context.
    // Provide a helpful error.
    void params;
    void ctx;
    throw new CloakError(
      'NOT_IMPLEMENTED',
      'storage.load after launch is not supported. Recreate the session with --storage-state=<path>.'
    );
  },

  'local_storage.get': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const data = (await ref.page.evaluate(
      `(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) o[k] = localStorage.getItem(k); } return o; })()`
    )) as Record<string, string>;
    return { local_storage: data };
  },

  'local_storage.set': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const key = reqStr(params, 'key');
    const value = reqStr(params, 'value');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(
      `(args) => { localStorage.setItem(args.key, args.value); }`,
      { key, value }
    );
    return { set: key };
  },

  'local_storage.clear': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(`localStorage.clear()`);
    return { cleared: true };
  },

  'session_storage.get': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const data = (await ref.page.evaluate(
      `(() => { const o = {}; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k) o[k] = sessionStorage.getItem(k); } return o; })()`
    )) as Record<string, string>;
    return { session_storage: data };
  },

  'session_storage.set': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const key = reqStr(params, 'key');
    const value = reqStr(params, 'value');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(
      `(args) => { sessionStorage.setItem(args.key, args.value); }`,
      { key, value }
    );
    return { set: key };
  },

  'session_storage.clear': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    await ref.page.evaluate(`sessionStorage.clear()`);
    return { cleared: true };
  },
};
