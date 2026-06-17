import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { fail, type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

export function buildWaitCmd(g: GF): Command {
  return new Command('wait').description('Wait for a condition').argument('<session_id>')
    .option('--selector <sel>')
    .option('--text <text>')
    .option('--url <pattern>')
    .option('--state <state>', 'visible|hidden|attached|detached')
    .option('--load-state <state>', 'load|domcontentloaded|networkidle')
    .option('--timeout <ms>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.selector) params.selector = opts.selector;
      if (opts.text) params.text = opts.text;
      if (opts.url) params.url = opts.url;
      if (opts.state) params.state = opts.state;
      if (opts.loadState) params.load_state = opts.loadState;
      if (opts.timeout) params.timeout = Number(opts.timeout);
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.wait', params, sid, flags);
    });
}

export function buildSleepCmd(g: GF): Command {
  return new Command('sleep').description('Sleep for N milliseconds').argument('<session_id>').argument('<ms>')
    .option('--page <id>')
    .action(async (sid: string, ms: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { ms: Number(ms) };
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.sleep', params, sid, flags);
    });
}

export function buildSnapshotCmd(g: GF): Command {
  return new Command('snapshot').description('Tag interactive elements with uids and return a tree (agent-friendly)').argument('<session_id>')
    .option('--page <id>')
    .option('--compact', 'Omit bbox and selector from each element (lighter output)')
    .option('--limit <n>', 'Max number of elements to return')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      if (opts.compact) params.compact = true;
      if (opts.limit) params.limit = Number(opts.limit);
      await callDaemon('page.snapshot', params, sid, flags);
    });
}

export function buildFramesCmd(g: GF): Command {
  return new Command('frames').description('List page frames').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.frames', params, sid, flags);
    });
}

export function buildA11yCmd(g: GF): Command {
  return new Command('a11y').description('Get the accessibility tree').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.accessibility', params, sid, flags);
    });
}

export function buildRequestCmd(g: GF): Command {
  return new Command('request').description('Make an HTTP request through the session context').argument('<session_id>').argument('<url>')
    .option('--method <m>', 'GET|POST|PUT|DELETE|...')
    .option('--header <kv>', 'Header as "Name: Value"; repeatable', collect, [])
    .option('--body <data>', 'Raw body (string)')
    .option('--json <body>', 'JSON body string')
    .option('--form <kv>', 'Form field "key=value"; repeatable', collect, [])
    .option('--timeout <ms>')
    .action(async (sid: string, url: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { url };
      if (opts.method) params.method = opts.method;
      if (Array.isArray(opts.header) && opts.header.length) {
        const h: Record<string, string> = {};
        for (const kv of opts.header as string[]) {
          const idx = kv.indexOf(':');
          if (idx > 0) h[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
        }
        params.headers = h;
      }
      if (opts.body !== undefined) params.body = opts.body;
      if (opts.json !== undefined) {
        try {
          params.body = JSON.parse(opts.json as string);
          const headers = (params.headers as Record<string, string>) ?? {};
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
          params.headers = headers;
        } catch (err) { fail(err, flags); }
      }
      if (Array.isArray(opts.form) && opts.form.length) {
        const f: Record<string, string> = {};
        for (const kv of opts.form as string[]) {
          const idx = kv.indexOf('=');
          if (idx > 0) f[kv.slice(0, idx)] = kv.slice(idx + 1);
        }
        params.form = f;
      }
      if (opts.timeout) params.timeout = Number(opts.timeout);
      await callDaemon('network.request', params, sid, flags);
    });
}

export function buildDialogCmd(g: GF): Command {
  return new Command('dialog').description('Handle the next alert/confirm/prompt dialog').argument('<session_id>')
    .requiredOption('--action <name>', 'accept|dismiss')
    .option('--text <text>', 'Prompt response (only for accept)')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { action: opts.action };
      if (opts.text) params.text = opts.text;
      if (opts.page) params.page_id = opts.page;
      await callDaemon('dialog.handle_next', params, sid, flags);
    });
}

function collect(value: string, previous: unknown): string[] {
  const arr = Array.isArray(previous) ? (previous as string[]) : [];
  return [...arr, value];
}