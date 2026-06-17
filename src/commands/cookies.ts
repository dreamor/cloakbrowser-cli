import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { fail, type GlobalFlags } from '../output.js';
import { CloakError } from '../errors.js';

type GF = () => GlobalFlags;

export function buildCookiesCmd(g: GF): Command {
  const cmd = new Command('cookies').description('Cookie management');

  cmd.command('get <session_id>')
    .option('--url <url>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.url) params.url = opts.url;
      await callDaemon('cookies.get', params, sid, flags);
    });

  cmd.command('set <session_id>')
    .option('--file <path>', 'Read cookies array from JSON file')
    .option('--json <json>', 'Cookies array as JSON string')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      try {
        let cookies: unknown;
        if (opts.file) cookies = JSON.parse(readFileSync(opts.file as string, 'utf8'));
        else if (opts.json) cookies = JSON.parse(opts.json as string);
        else {
          cookies = JSON.parse(readStdin());
        }
        if (!Array.isArray(cookies)) {
          throw new CloakError('INVALID_ARG', 'cookies must be a JSON array');
        }
        await callDaemon('cookies.set', { cookies }, sid, flags);
      } catch (err) {
        fail(err, flags);
      }
    });

  cmd.command('clear <session_id>')
    .action(async (sid: string) => {
      const flags = g();
      await callDaemon('cookies.clear', {}, sid, flags);
    });

  return cmd;
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    throw new CloakError('INVALID_ARG', 'Provide --file, --json, or pipe JSON via stdin');
  }
}

export function buildStorageCmd(g: GF): Command {
  const cmd = new Command('storage').description('Storage state (cookies + localStorage)');

  cmd.command('save <session_id> <path>')
    .action(async (sid: string, path: string) => {
      const flags = g();
      await callDaemon('storage.save', { path }, sid, flags);
    });

  cmd.command('load <session_id> <path>')
    .description('Note: storage state can only be loaded at session launch — recreate the session instead')
    .action(async (sid: string, path: string) => {
      const flags = g();
      await callDaemon('storage.load', { path }, sid, flags);
    });

  return cmd;
}

function makeKv(g: GF, name: 'local_storage' | 'session_storage', cmdName: string): Command {
  const cmd = new Command(cmdName).description(`${name.replace('_', '-')} get/set/clear`);
  cmd.command('get <session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon(`${name}.get`, params, sid, flags);
    });
  cmd.command('set <session_id> <key> <value>')
    .option('--page <id>')
    .action(async (sid: string, key: string, value: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { key, value };
      if (opts.page) params.page_id = opts.page;
      await callDaemon(`${name}.set`, params, sid, flags);
    });
  cmd.command('clear <session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon(`${name}.clear`, params, sid, flags);
    });
  return cmd;
}

export function buildLocalStorageCmd(g: GF): Command { return makeKv(g, 'local_storage', 'local-storage'); }
export function buildSessionStorageCmd(g: GF): Command { return makeKv(g, 'session_storage', 'session-storage'); }