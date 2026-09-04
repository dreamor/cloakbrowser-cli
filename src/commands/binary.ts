import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Command } from 'commander';
import { ok, fail, type GlobalFlags } from '../output.js';
import { loadCloakBrowser, withCloakbrowserStdoutRerouted } from '../browser.js';
import { CloakError } from '../errors.js';

const execFileAsync = promisify(execFile);

type GF = () => GlobalFlags;

/**
 * Binary subcommand: thin shim around cloakbrowser's JS API
 * (ensureBinary, binaryInfo, clearCache). The cloakbrowser package
 * also exposes a Python `python -m cloakbrowser` CLI; this command
 * uses the JS surface so it works on Node-only installs.
 */
export function buildBinaryCmd(g: GF): Command {
  const cmd = new Command('binary').description('Manage the stealth Chromium binary');

  cmd.command('install')
    .description('Pre-download the stealth Chromium binary')
    .action(async () => {
      const flags = g();
      try {
        const cb = await loadCloakBrowser();
        if (!cb.ensureBinary) {
          fail(new Error('cloakbrowser.ensureBinary not available — upgrade cloakbrowser'), flags);
          return;
        }
        const path = await withCloakbrowserStdoutRerouted(() => cb.ensureBinary!());
        ok({ installed: true, path }, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('info')
    .description('Show binary info (version, path, platform)')
    .action(async () => {
      const flags = g();
      try {
        const cb = await loadCloakBrowser();
        const info = cb.binaryInfo ? cb.binaryInfo() : { unavailable: true };
        ok(info, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('update')
    .description('Check for and download newer binary (ensureBinary)')
    .action(async () => {
      const flags = g();
      try {
        const cb = await loadCloakBrowser();
        if (!cb.ensureBinary) {
          fail(new Error('cloakbrowser.ensureBinary not available'), flags);
          return;
        }
        const path = await withCloakbrowserStdoutRerouted(() => cb.ensureBinary!());
        ok({ updated: true, path }, flags);
      } catch (err) { fail(err, flags); }
    });

  cmd.command('clear-cache')
    .description('Remove cached binaries')
    .action(async () => {
      const flags = g();
      try {
        const cb = await loadCloakBrowser();
        if (!cb.clearCache) {
          fail(new Error('cloakbrowser.clearCache not available'), flags);
          return;
        }
        cb.clearCache();
        ok({ cleared: true }, flags);
      } catch (err) { fail(err, flags); }
    });

  return cmd;
}

/**
 * `cloak serve` — spawn cloakserve via Python module (cloakbrowser's official CDP server).
 * Requires Python install of cloakbrowser. For pure-Node use cases, agents can still use
 * `cloak session new` + `cloak goto ...`.
 */
export function buildServeCmd(g: GF): Command {
  return new Command('serve').description('Run the CloakBrowser CDP server (cloakserve) — requires Python install')
    .option('--port <port>', 'CDP port', '9222')
    .option('--host <host>', 'CDP host', '127.0.0.1')
    .option('--headless <bool>', 'true|false')
    .option('--proxy-server <url>')
    .action(async (opts: Record<string, unknown>) => {
      const flags = g();
      const py = process.env.PYTHON ?? 'python3';

      // Preflight with captured (not inherited) stdio so a missing
      // Python/cloakbrowser install surfaces as our usual JSON envelope
      // with a real `code`, instead of a raw interpreter traceback on
      // stderr with no way for an agent to distinguish it from any other
      // failure. Once this passes, the real server below still uses
      // `stdio: 'inherit'` — cloakserve is a long-running process whose
      // live logs are the point, not something to buffer into one blob.
      try {
        await execFileAsync(py, ['-c', 'import cloakbrowser.cloakserve']);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException & { stderr?: string };
        if (nodeErr.code === 'ENOENT') {
          fail(new CloakError(
            'MISSING_DEPENDENCY',
            `Python interpreter '${py}' not found. Install Python, or set the PYTHON env var to its path.`
          ), flags);
        } else {
          fail(new CloakError(
            'MISSING_DEPENDENCY',
            `Python 'cloakbrowser' module not importable via '${py}'. Install with: pip install cloakbrowser`,
            { cause: (nodeErr.stderr ?? nodeErr.message ?? '').trim() }
          ), flags);
        }
        return;
      }

      const args: string[] = ['-m', 'cloakbrowser.cloakserve'];
      if (opts.port) args.push(`--port=${opts.port}`);
      if (opts.host) args.push(`--host=${opts.host}`);
      if (opts.headless) args.push(`--headless=${opts.headless}`);
      if (opts.proxyServer) args.push(`--proxy-server=${opts.proxyServer}`);

      const child = spawn(py, args, { stdio: 'inherit' });
      child.on('error', (err) => fail(err, flags));
      child.on('exit', (code) => {
        if (code === 0) ok({ exited: 0 }, flags);
        else process.exit(code ?? 1);
      });
    });
}

export function buildConnectCmd(g: GF): Command {
  return new Command('connect').description('Attach to an already-running browser over its CDP endpoint (does not launch a new browser)')
    .argument('<ws_url>', 'CDP endpoint (ws://.../devtools/browser/<id> or http://host:port)')
    .option('--timeout <ms>', 'Fail fast if the endpoint does not respond within this time', '10000')
    .option('--ttl-ms <ms>', 'Idle TTL in ms (default 1h)')
    .action(async (wsUrl: string, opts: Record<string, unknown>) => {
      const flags = g();
      try {
        const { getClient } = await import('../client.js');
        const params: Record<string, unknown> = { ws_url: wsUrl };
        if (opts.timeout) params.timeout_ms = Number(opts.timeout);
        if (opts.ttlMs) params.ttl_ms = Number(opts.ttlMs);
        const data = (await getClient().call('session.connect', params)) as { session_id: string; page_id: string };
        ok(data, flags, { session_id: data.session_id, page_id: data.page_id });
      } catch (err) { fail(err, flags); }
    });
}
