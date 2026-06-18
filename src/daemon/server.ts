import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { existsSync, unlinkSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { paths, ensureRoot } from '../utils/paths.js';
import { Registry } from './registry.js';
import { send, readLines, makeError, makeOk, type RpcRequest, type RpcResponse } from './protocol.js';
import { dispatch } from './methods/index.js';
import { CloakError } from '../errors.js';

export type DaemonServer = {
  server: Server;
  registry: Registry;
  port?: number;
  socketPath?: string;
  stop: () => Promise<void>;
};

const startedAt = Date.now();

/**
 * Probe whether a Unix socket is actually listening.
 * Resolves `true` if a connection succeeds, `false` if ECONNREFUSED or timeout.
 */
function isSocketAlive(sockPath: string, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(sockPath, () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    const timer = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, timeoutMs);
    timer.unref?.();
  });
}

export async function startServer(): Promise<DaemonServer> {
  ensureRoot();
  if (existsSync(paths.sock)) {
    // Verify the existing socket is still alive before removing
    const alive = await isSocketAlive(paths.sock);
    if (alive) {
      throw new CloakError(
        'DAEMON_ALREADY_RUNNING',
        'Another daemon is already listening on the socket',
      );
    }
    // Stale socket — safe to remove
    try {
      unlinkSync(paths.sock);
    } catch {
      // ignore
    }
  }

  const registry = new Registry();
  registry.start();

  const server = createServer((sock) => handleConnection(sock, registry));

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(paths.sock, () => {
      server.off('error', reject);
      resolve();
    });
  });

  // Restrict socket to owner-only access (0600)
  try { chmodSync(paths.sock, 0o600); } catch { /* best-effort */ }

  writeFileSync(paths.pid, String(process.pid));

  const stop = async (): Promise<void> => {
    await registry.closeAll();
    registry.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      if (existsSync(paths.sock)) unlinkSync(paths.sock);
      if (existsSync(paths.pid)) unlinkSync(paths.pid);
    } catch {
      // ignore
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      stop().finally(() => process.exit(0));
    });
  }

  return { server, registry, socketPath: paths.sock, stop };
}

function handleConnection(sock: Socket, registry: Registry): void {
  const lines = readLines(sock);
  lines.on('line', (raw: string) => {
    if (!raw.trim()) return;
    handleLine(sock, raw, registry).catch((err) => {
      try {
        send(sock, makeError('unknown', err));
      } catch {
        // ignore
      }
    });
  });
  sock.on('error', () => undefined);
}

async function handleLine(sock: Socket, raw: string, registry: Registry): Promise<void> {
  let req: RpcRequest;
  try {
    req = JSON.parse(raw) as RpcRequest;
  } catch (err) {
    send(sock, makeError('unknown', new CloakError('INVALID_JSON', (err as Error).message)));
    return;
  }
  if (!req || typeof req.id !== 'string' || typeof req.method !== 'string') {
    send(sock, makeError(req?.id ?? 'unknown', new CloakError('INVALID_ARG', 'Request must have id and method')));
    return;
  }

  let response: RpcResponse;
  try {
    const data = await dispatch(req.method, req.params ?? {}, registry, { startedAt });
    response = makeOk(req.id, data);
  } catch (err) {
    response = makeError(req.id, err);
  }
  send(sock, response);
}

export function readPid(): number | undefined {
  try {
    const raw = readFileSync(paths.pid, 'utf8').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
