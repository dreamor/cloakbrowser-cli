import { Command } from 'commander';
import { createInterface } from 'node:readline';
import { getClient, type RpcCallOptions } from '../client.js';
import { ok, fail, type GlobalFlags } from '../output.js';
import { resolveSid, saveLastSession } from '../utils/session-resolver.js';
import { CloakError } from '../errors.js';

type GF = () => GlobalFlags;

const BATCH_MAX_BYTES_DEFAULT = 1_000_000;
const BATCH_MAX_LINES_DEFAULT = 200;

type BatchLine = {
  method: string;
  params?: Record<string, unknown>;
};

/**
 * Read stdin JSON lines. Throws on parse failures or limit violations.
 */
async function readStdinLines(
  maxBytes: number,
  maxLines: number,
): Promise<BatchLine[]> {
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines: BatchLine[] = [];
  let totalBytes = 0;

  for await (const raw of reader) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    totalBytes += Buffer.byteLength(trimmed, 'utf-8');
    if (totalBytes > maxBytes) {
      throw new CloakError(
        'INVALID_ARG',
        `Batch input exceeds ${maxBytes} byte limit (read ${totalBytes} so far). Increase with CLOAK_BATCH_MAX_BYTES environment variable.`,
      );
    }

    if (lines.length >= maxLines) {
      throw new CloakError(
        'INVALID_ARG',
        `Batch input exceeds ${maxLines} line limit. Increase with CLOAK_BATCH_MAX_LINES environment variable.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new CloakError(
        'INVALID_JSON',
        `Failed to parse line ${lines.length + 1} as JSON: ${trimmed.slice(0, 100)}`,
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.method !== 'string' || !obj.method) {
      throw new CloakError(
        'INVALID_ARG',
        `Line ${lines.length + 1} is missing required "method" field`,
      );
    }

    lines.push({
      method: obj.method,
      params: (obj.params as Record<string, unknown>) ?? {},
    });
  }

  return lines;
}

export function buildBatchCmd(g: GF): Command {
  return new Command('batch')
    .description(
      'Execute multiple daemon commands from stdin JSON lines. Each line: {"method":"<rpc>","params":{..., "session_id":"<sid>"}}',
    )
    .option('--session <sid>', 'Default session_id applied to all lines unless overridden per-line')
    .option(
      '--abort-on-error',
      'Stop processing on first error (default: continue, emitting error results)',
    )
    .action(async (opts: Record<string, unknown>) => {
      const flags = g();

      const envMaxBytes = process.env.CLOAK_BATCH_MAX_BYTES
        ? Number(process.env.CLOAK_BATCH_MAX_BYTES)
        : BATCH_MAX_BYTES_DEFAULT;
      const envMaxLines = process.env.CLOAK_BATCH_MAX_LINES
        ? Number(process.env.CLOAK_BATCH_MAX_LINES)
        : BATCH_MAX_LINES_DEFAULT;

      // Read lines — fail() exits process, so we return for TypeScript flow analysis
      let lines: BatchLine[];
      try {
        lines = await readStdinLines(envMaxBytes, envMaxLines);
      } catch (err) {
        fail(err, flags);
        return;
      }

      const defaultSession = opts.session ? resolveSid(opts.session as string) : undefined;
      const abortOnError = Boolean(opts.abortOnError);
      const client = getClient();

      // Connect once
      try {
        await client.ensureRunning(true);
        await client.connect();
      } catch (err) {
        fail(err, flags);
        return;
      }

      const results: unknown[] = [];

      for (const line of lines) {
        const params = { ...(line.params ?? {}) };

        try {
          // Resolve session_id: line params > default session > fail
          if (params.session_id && typeof params.session_id === 'string') {
            params.session_id = resolveSid(params.session_id as string);
          } else if (defaultSession) {
            params.session_id = defaultSession;
          }

          if (!params.session_id) {
            throw new CloakError(
              'INVALID_ARG',
              `Line has no session_id and no --session default was provided`,
            );
          }

          // Save last session (matches callDaemon in shared.ts)
          saveLastSession(params.session_id as string);

          const data = await client.call(line.method, params, { autostart: false });
          results.push({ ok: true, data });
        } catch (err) {
          const cloak = err instanceof CloakError ? err : new CloakError('INTERNAL_ERROR', String(err));
          results.push({ ok: false, error: cloak.toJSON() });
          if (abortOnError) break;
        }
      }

      ok(results, flags);
    });
}