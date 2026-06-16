import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { launchFromResolved, getPageOrCreate } from '../../browser.js';
import { resolveLaunchOpts, type LaunchOpts } from '../../options.js';
import { reqStr } from './params.js';

export const sessionMethods: Record<string, MethodFn> = {
  'session.new': async (params: Record<string, unknown>, ctx: MethodCtx) => {
    const opts = (params.opts ?? {}) as LaunchOpts;
    const ttlMs = typeof params.ttl_ms === 'number' ? params.ttl_ms : undefined;

    const resolved = resolveLaunchOpts(opts);
    const handle = await launchFromResolved(resolved);
    const rec = ctx.registry.registerSession(handle, { launch: resolved.launchOptions, persistent: resolved.persistentDir ?? null }, ttlMs);

    // Auto-create one page so the agent can start operating immediately
    const page = await getPageOrCreate(handle);
    const pageId = ctx.registry.registerPage(rec.id, page);

    return { session_id: rec.id, page_id: pageId };
  },

  'session.list': (_p, ctx: MethodCtx) => ctx.registry.listSessions(),

  'session.info': (params, ctx: MethodCtx) => {
    const id = reqStr(params, 'session_id');
    return ctx.registry.describeSession(id);
  },

  'session.close': async (params, ctx: MethodCtx) => {
    const id = reqStr(params, 'session_id');
    const closed = await ctx.registry.closeSession(id);
    return { closed };
  },

  'session.save_state': async (params, ctx: MethodCtx) => {
    const id = reqStr(params, 'session_id');
    const path = reqStr(params, 'path');
    const rec = ctx.registry.requireSession(id);
    if (rec.handle.kind !== 'context') {
      // Need a context to call storageState
      const first = rec.handle.browser.contexts()[0];
      if (!first) throw new CloakError('INTERNAL_ERROR', 'No context available to save state');
      await first.storageState({ path });
    } else {
      await rec.handle.context.storageState({ path });
    }
    return { path };
  },
};
