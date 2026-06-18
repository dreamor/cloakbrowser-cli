import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, chmodSync } from 'node:fs';

const ROOT = process.env.CLOAK_CLI_HOME ?? join(homedir(), '.cloak');

export const paths = {
  root: ROOT,
  sock: process.env.CLOAK_CLI_SOCK ?? join(ROOT, 'daemon.sock'),
  pid: join(ROOT, 'daemon.pid'),
  log: join(ROOT, 'daemon.log'),
  sessions: join(ROOT, 'sessions'),
  tmp: join(tmpdir(), 'cloak-cli'),
} as const;

export function ensureRoot(): void {
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  try { chmodSync(paths.root, 0o700); } catch { /* best-effort */ }
  mkdirSync(paths.sessions, { recursive: true, mode: 0o700 });
  mkdirSync(paths.tmp, { recursive: true });
}
