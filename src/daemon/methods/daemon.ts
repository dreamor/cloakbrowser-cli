import type { MethodCtx, MethodFn } from './index.js';

export const daemonMethods: Record<string, MethodFn> = {
  'daemon.ping': () => ({ pong: true, ts: Date.now() }),
  'daemon.status': (_p, ctx: MethodCtx) => ({
    pid: process.pid,
    uptime_ms: Date.now() - ctx.startedAt,
    sessions: ctx.registry.listSessions().length,
    node: process.version,
    platform: process.platform,
  }),
  'daemon.methods': () => {
    // late import to avoid cycle
    return import('./index.js').then((m) => m.listMethods());
  },
  'daemon.shutdown': async (_p, ctx: MethodCtx) => {
    await ctx.registry.closeAll();
    // Schedule exit after response is flushed
    setTimeout(() => process.exit(0), 50);
    return { stopping: true };
  },
};
