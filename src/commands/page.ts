import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { type GlobalFlags } from '../output.js';

export function buildPageCmd(globalFlags: () => GlobalFlags): Command {
  const cmd = new Command('page').description('Manage pages within a session');

  cmd.command('new <session_id>')
    .description('Open a new page in the session')
    .action(async (sid: string) => {
      const flags = globalFlags();
      await callDaemon('page.new', {}, sid, flags);
    });

  cmd.command('list <session_id>')
    .description('List pages in the session')
    .action(async (sid: string) => {
      const flags = globalFlags();
      await callDaemon('page.list', {}, sid, flags);
    });

  cmd.command('close <session_id> <page_id>')
    .description('Close a specific page')
    .action(async (sid: string, pid: string) => {
      const flags = globalFlags();
      await callDaemon('page.close', { page_id: pid }, sid, flags);
    });

  cmd.command('activate <session_id> <page_id>')
    .description('Make a page the default for the session')
    .action(async (sid: string, pid: string) => {
      const flags = globalFlags();
      await callDaemon('page.activate', { page_id: pid }, sid, flags);
    });

  return cmd;
}