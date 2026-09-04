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
      const v = await ref.page.evaluate(buildEvalFn(expr), params.arg);
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
      const v = await ref.page.evaluate(buildEvalFn(code), params.arg);
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
 *
 * A snippet that "doesn't look like a function" isn't necessarily a
 * single expression either — `const x = 1; x + 2` also fails that check
 * but is a syntax error once wrapped as `(arg) => (const x = 1; x + 2)`
 * (you can't put statements in an expression position). If wrapping as an
 * expression is a syntax error, fall back to a statement *body* instead —
 * same as page.eval_file's full scripts, the caller then needs an explicit
 * `return` to get a value back.
 */
function buildEvalFn(src: string): (...args: unknown[]) => unknown {
  if (!looksLikeExpression(src)) return toPageFn(src);
  try {
    return toPageFn(`(arg) => (${src})`);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return toPageFn(`(arg) => { ${src} }`);
  }
}

function serialize(value: unknown): unknown {
  // undefined has no JSON representation — without this, JSON.stringify(undefined)
  // returns the *value* undefined (not a string), JSON.parse coerces that
  // back to the string "undefined", and parsing "undefined" as JSON throws,
  // so the catch below used to turn it into the literal string "undefined"
  // instead of a JSON-null "no value".
  if (value === undefined) return null;
  // Best-effort JSON sanitization. Non-serializable values become string descriptions.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
