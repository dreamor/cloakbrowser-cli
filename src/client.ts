import { createConnection, type Socket } from 'node:net';
import { createInterface } from 'node:readline';
import { paths } from './utils/paths.js';
import { CloakError } from './errors.js';
import { nextId, type RpcRequest, type RpcResponse } from './daemon/protocol.js';
import { spawnDetached, status } from './daemon/lifecycle.js';

export type RpcCallOptions = {
  autostart?: boolean;
  timeoutMs?: number;
};

export class DaemonClient {
  private sock: Socket | undefined;
  private buf: string = '';
  private readonly inflight = new Map<string, {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout | undefined;
  }>();
  private opened = false;

  async ensureRunning(autostart: boolean): Promise<void> {
    if (status().running) return;
    if (!autostart) {
      throw new CloakError(
        'DAEMON_NOT_RUNNING',
        "Daemon not running. Start with 'cloak daemon start'."
      );
    }
    await spawnDetached();
  }

  async connect(): Promise<void> {
    if (this.opened) return;
    await new Promise<void>((resolve, reject) => {
      const sock = createConnection(paths.sock, () => {
        this.opened = true;
        resolve();
      });
      sock.on('error', (err) => {
        if (!this.opened) reject(err);
      });
      sock.on('close', () => {
        this.opened = false;
        for (const [, h] of this.inflight) {
          if (h.timer) clearTimeout(h.timer);
          h.reject(new CloakError('DAEMON_NOT_RUNNING', 'Daemon connection closed'));
        }
        this.inflight.clear();
      });
      const rl = createInterface({ input: sock, crlfDelay: Infinity });
      rl.on('line', (line: string) => this.onLine(line));
      this.sock = sock;
    });
  }

  private onLine(line: string): void {
    if (!line.trim()) return;
    let msg: RpcResponse;
    try {
      msg = JSON.parse(line) as RpcResponse;
    } catch {
      return;
    }
    const handler = this.inflight.get(msg.id);
    if (!handler) return;
    this.inflight.delete(msg.id);
    if (handler.timer) clearTimeout(handler.timer);
    if (msg.ok) {
      handler.resolve(msg.data);
    } else {
      const cloak = new CloakError(msg.error.code, msg.error.message, msg.error.details);
      handler.reject(cloak);
    }
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}, opts: RpcCallOptions = {}): Promise<T> {
    await this.ensureRunning(opts.autostart ?? true);
    await this.connect();
    if (!this.sock) throw new CloakError('DAEMON_NOT_RUNNING', 'Socket not connected');
    const id = nextId();
    const req: RpcRequest = { id, method, params };
    return new Promise<T>((resolve, reject) => {
      const ms = opts.timeoutMs ?? 30_000;
      const timer = setTimeout(() => {
        this.inflight.delete(id);
        reject(new CloakError('TIMEOUT', `RPC ${method} timed out after ${ms}ms`));
      }, ms);
      this.inflight.set(id, { resolve: (v) => resolve(v as T), reject, timer });
      this.sock!.write(JSON.stringify(req) + '\n');
    });
  }

  close(): void {
    if (this.sock) {
      this.sock.end();
      this.sock.destroy();
      this.sock = undefined;
    }
    this.opened = false;
  }
}

let shared: DaemonClient | undefined;
export function getClient(): DaemonClient {
  if (!shared) shared = new DaemonClient();
  return shared;
}
