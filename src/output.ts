import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import chalk from 'chalk';
import { CloakError, fromUnknown } from './errors.js';
import { validateWritePath } from './utils/safepath.js';

export type GlobalFlags = {
  pretty: boolean;
  quiet: boolean;
  out?: string;
};

export type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: ReturnType<CloakError['toJSON']>;
  session_id?: string;
  page_id?: string;
};

const isTty = (): boolean => Boolean(process.stdout.isTTY);

function colorize(value: unknown, pretty: boolean): string {
  if (!pretty) return JSON.stringify(value);
  const text = JSON.stringify(value, null, 2);
  if (!isTty()) return text;
  return text
    .replace(/"([^"]+)":/g, (_, k) => `${chalk.cyan(`"${k}"`)}:`)
    .replace(/: "([^"]*)"/g, (_, v) => `: ${chalk.green(`"${v}"`)}`)
    .replace(/: (true|false|null)/g, (_, v) => `: ${chalk.yellow(v)}`)
    .replace(/: (-?\d+(?:\.\d+)?)/g, (_, v) => `: ${chalk.magenta(v)}`);
}

export function emit(envelope: Envelope, flags: GlobalFlags): void {
  const stream = envelope.ok ? process.stdout : process.stderr;
  const payload = flags.quiet && envelope.ok ? envelope.data : envelope;
  const serialized = colorize(payload, flags.pretty || isTty());

  // If --out is set and this is a successful response, write JSON to file
  if (flags.out && envelope.ok) {
    const buf = Buffer.from(serialized + '\n', 'utf-8');
    const meta = writeBinaryOut(buf, flags.out);
    // Still output a small envelope so the agent gets the file path
    const outEnvelope = { ok: true, data: meta, session_id: envelope.session_id, page_id: envelope.page_id };
    stream.write(colorize(outEnvelope, flags.pretty || isTty()) + '\n');
    return;
  }

  stream.write(serialized + '\n');
}

export function ok(data: unknown, flags: GlobalFlags, ids?: { session_id?: string; page_id?: string }): void {
  emit({ ok: true, data, ...(ids ?? {}) }, flags);
}

export function fail(err: unknown, flags: GlobalFlags): never {
  const cloak = fromUnknown(err);
  emit({ ok: false, error: cloak.toJSON() }, flags);
  process.exit(1);
}

export function writeBinaryOut(buf: Buffer, path: string): { path: string; size: number; sha256: string } {
  const safePath = validateWritePath(path);
  writeFileSync(safePath, buf);
  return {
    path: safePath,
    size: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}

export function maybeFileOrBase64(
  buf: Buffer,
  out: string | undefined
): { path?: string; size: number; sha256: string; base64?: string } {
  if (out) return writeBinaryOut(buf, out);
  return {
    size: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    base64: buf.toString('base64'),
  };
}
