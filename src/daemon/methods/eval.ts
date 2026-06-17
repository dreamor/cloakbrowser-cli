import { readFileSync } from 'node:fs';
import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, reqStr } from './params.js';

export const evalMethods: Record<string, MethodFn> = {
  'page.eval': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const expr = reqStr(params, 'expression');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    try {
      const wrapped = looksLikeExpression(expr) ? `(() => (${expr}))()` : expr;
      const v = await ref.page.evaluate(wrapped, params.arg);
      return { value: serialize(v) };
    } catch (err) {
      throw new CloakError('EVAL_FAILED', (err as Error).message);
    }
  },

  'page.eval_file': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const path = reqStr(params, 'path');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const code = readFileSync(path, 'utf8');
    const v = await ref.page.evaluate(code, params.arg);
    return { value: serialize(v), path };
  },
};

function looksLikeExpression(src: string): boolean {
  const trimmed = src.trim();
  return !trimmed.startsWith('(') && !trimmed.startsWith('function') && !trimmed.startsWith('async');
}

function serialize(value: unknown): unknown {
  // Best-effort JSON sanitization. Non-serializable values become string descriptions.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
