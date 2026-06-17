import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { fail, type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

export function buildEvalCmd(g: GF): Command {
  return new Command('eval').description('Evaluate JS in the page').argument('<session_id>').argument('<expression>')
    .option('--page <id>')
    .option('--arg <json>', 'Argument passed to the function as JSON')
    .action(async (sid: string, expr: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { expression: expr };
      if (opts.page) params.page_id = opts.page;
      if (opts.arg) {
        try { params.arg = JSON.parse(opts.arg as string); }
        catch (err) { return fail(err, flags); }
      }
      await callDaemon('page.eval', params, sid, flags);
    });
}

export function buildEvalFileCmd(g: GF): Command {
  return new Command('eval-file').description('Evaluate JS from a file in the page').argument('<session_id>').argument('<path>')
    .option('--page <id>')
    .option('--arg <json>')
    .action(async (sid: string, path: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { path };
      if (opts.page) params.page_id = opts.page;
      if (opts.arg) {
        try { params.arg = JSON.parse(opts.arg as string); }
        catch (err) { return fail(err, flags); }
      }
      await callDaemon('page.eval_file', params, sid, flags);
    });
}