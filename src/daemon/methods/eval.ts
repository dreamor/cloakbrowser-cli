import { readFileSync } from 'node:fs';
import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, reqStr } from './params.js';
import { validateReadPath } from '../../utils/safepath.js';
import { toPageFn } from '../../utils/page-fn.js';

export const evalMethods: Record<string, MethodFn> = {
  'page.eval': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const expr = reqStr(params, 'expression');
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    try {
      const v = await ref.page.evaluate(toPageFn(wrapForArg(expr)), params.arg);
      return { value: serialize(v) };
    } catch (err) {
      throw new CloakError('EVAL_FAILED', (err as Error).message);
    }
  },

  'page.eval_file': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const rawPath = reqStr(params, 'path');
    const safePath = validateReadPath(rawPath);
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    const code = readFileSync(safePath, 'utf8');
    try {
      const v = await ref.page.evaluate(toPageFn(wrapForArg(code)), params.arg);
      return { value: serialize(v), path: safePath };
    } catch (err) {
      throw new CloakError('EVAL_FAILED', (err as Error).message);
    }
  },
};

function looksLikeExpression(src: string): boolean {
  const trimmed = src.trim();
  return !trimmed.startsWith('(') && !trimmed.startsWith('function') && !trimmed.startsWith('async');
}

/**
 * Playwright only binds `arg` to an actual function parameter (see
 * utils/page-fn.ts), so a bare expression like `document.title` needs
 * wrapping in a function that takes `arg` — even when it doesn't use it —
 * to become callable. If the caller already wrote their own function
 * literal (e.g. `(sel) => document.querySelector(sel).click()`), pass it
 * straight through so `--arg` binds to *their* parameter name instead of
 * being shadowed by a wrapper.
 */
function wrapForArg(src: string): string {
  return looksLikeExpression(src) ? `(arg) => (${src})` : src;
}

function serialize(value: unknown): unknown {
  // Best-effort JSON sanitization. Non-serializable values become string descriptions.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
