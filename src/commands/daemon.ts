import { Command } from 'commander';
import { getClient } from '../client.js';
import { ok, fail, type GlobalFlags } from '../output.js';
import { status, spawnDetached, stopDaemon } from '../daemon/lifecycle.js';

type GF = () => GlobalFlags;

export function buildDaemonCmd(_g: GF): Command {
  const cmd = new Command('daemon').description('Manage the cloak daemon');

  cmd.command('start')
    .option('--log <path>')
    .description('Start the daemon in the background')
    .action(async (opts: Record<string, unknown>) => {
      const flags = _g();
      try {
        const startArgs: { logPath?: string } = {};
        if (opts.log) startArgs.logPath = opts.log as string;
        const s = await spawnDetached(startArgs);
        ok(s, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('stop')
    .description('Stop the daemon')
    .action(async () => {
      const flags = _g();
      try {
        const stopped = await stopDaemon();
        ok({ stopped }, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('status')
    .description('Show daemon status')
    .action(async () => {
      const flags = _g();
      try {
        const local = status();
        if (local.running) {
          const remote = await getClient().call('daemon.status');
          ok({ ...local, ...(remote as object) }, flags);
        } else {
          ok(local, flags);
        }
      } catch (err) { fail(err, flags); }
    });

  cmd.command('ping')
    .description('Ping the daemon')
    .action(async () => {
      const flags = _g();
      try {
        const data = await getClient().call('daemon.ping');
        ok(data, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('methods')
    .description('List all daemon RPC methods')
    .action(async () => {
      const flags = _g();
      try {
        const data = await getClient().call('daemon.methods');
        ok(data, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('foreground')
    .description('Run the daemon in the foreground (debug)')
    .action(async () => {
      const flags = _g();
      try {
        const { startServer } = await import('../daemon/server.js');
        await startServer();
        ok({ foreground: true, message: 'Daemon running. Press Ctrl-C to stop.' }, flags);
      } catch (err) { fail(err, flags); }
    });

  return cmd;
}