import type { MethodCtx, MethodFn } from './index.js';
import { CloakError } from '../../errors.js';
import { optStr, optNum, reqStr } from './params.js';

const DEFAULT_DIALOG_TIMEOUT_MS = 30_000;

/**
 * Install a one-shot dialog handler on a page. The next dialog will be
 * automatically accepted or dismissed. Useful for `window.alert/confirm/prompt`
 * pages that block navigation.
 */
export const dialogMethods: Record<string, MethodFn> = {
  'dialog.handle_next': async (params, ctx: MethodCtx) => {
    const sid = reqStr(params, 'session_id');
    const action = reqStr(params, 'action');
    if (action !== 'accept' && action !== 'dismiss') {
      throw new CloakError('INVALID_ARG', 'action must be "accept" or "dismiss"');
    }
    const text = optStr(params, 'text');
    const timeoutMs = optNum(params, 'timeout') ?? DEFAULT_DIALOG_TIMEOUT_MS;
    const ref = ctx.registry.requirePage(sid, optStr(params, 'page_id'));
    return await new Promise<{ handled: true; action: string; type: string; message: string }>((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;

      const handler = (...args: unknown[]): void => {
        if (timer) clearTimeout(timer);
        const dialog = args[0] as {
          type: () => string;
          message: () => string;
          accept: (t?: string) => Promise<void>;
          dismiss: () => Promise<void>;
        };
        ref.page.off?.('dialog', handler);
        const type = dialog.type();
        const message = dialog.message();
        const p = action === 'accept' ? dialog.accept(text ?? '') : dialog.dismiss();
        p.finally(() => resolve({ handled: true, action, type, message }));
      };
      ref.page.on('dialog', handler);

      timer = setTimeout(() => {
        ref.page.off?.('dialog', handler);
        reject(new CloakError('TIMEOUT', `No dialog appeared within ${timeoutMs}ms`));
      }, timeoutMs);
    });
  },
};
