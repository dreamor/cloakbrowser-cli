import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

export function buildNavCmd(globalFlags: GF): Command {
  const cmd = new Command('goto')
    .description('Navigate to a URL')
    .argument('<session_id>')
    .argument('<url>')
    .option('--page <id>', 'Target page id')
    .option('--wait-until <state>', 'load|domcontentloaded|networkidle|commit')
    .option('--timeout <ms>', 'Navigation timeout')
    .option('--referer <url>', 'Referer header')
    .option('--snapshot', 'Return a snapshot after navigation')
    .action(async (sid: string, url: string, opts: Record<string, unknown>) => {
      const flags = globalFlags();
      const params: Record<string, unknown> = { url };
      if (opts.page) params.page_id = opts.page;
      if (opts.waitUntil) params.wait_until = opts.waitUntil;
      if (opts.timeout) params.timeout = Number(opts.timeout);
      if (opts.referer) params.referer = opts.referer;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.goto', params, sid, flags);
    });
  return cmd;
}

function simpleNav(globalFlags: GF, name: string, method: string, desc: string): Command {
  return new Command(name)
    .description(desc)
    .argument('<session_id>')
    .option('--page <id>')
    .option('--timeout <ms>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = globalFlags();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      if (opts.timeout) params.timeout = Number(opts.timeout);
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon(method, params, sid, flags);
    });
}

export function buildBackCmd(g: GF): Command { return simpleNav(g, 'back', 'page.back', 'Go back in history'); }
export function buildForwardCmd(g: GF): Command { return simpleNav(g, 'forward', 'page.forward', 'Go forward in history'); }
export function buildReloadCmd(g: GF): Command { return simpleNav(g, 'reload', 'page.reload', 'Reload the page'); }

export function buildUrlCmd(g: GF): Command {
  return new Command('url').description('Get current URL').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.url', params, sid, flags);
    });
}

export function buildTitleCmd(g: GF): Command {
  return new Command('title').description('Get document title').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.title', params, sid, flags);
    });
}