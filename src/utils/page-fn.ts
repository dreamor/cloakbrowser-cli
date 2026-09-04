/**
 * Playwright's `page.evaluate()`/`waitForFunction()` only invoke
 * `pageFunction` (and bind `arg` to its parameter) when given a real
 * Function value. A string is always evaluated as a bare expression:
 * the second `arg` is silently dropped, and if the string happens to
 * look like a function literal, the *unevaluated* function object comes
 * back instead of the result of calling it — so `undefined`/false-truthy
 * results appear instead of a thrown error, with no indication anything
 * is wrong.
 *
 * Every in-page snippet that needs data passed in via `arg` must be
 * materialized into a genuine Function (its `document`/`window`/... free
 * variables are only resolved when Playwright ships the source into the
 * page and calls it there, not when this constructs the Function value
 * here in Node).
 */
export function toPageFn(source: string): (...args: unknown[]) => unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`return (${source});`)() as (...args: unknown[]) => unknown;
}
