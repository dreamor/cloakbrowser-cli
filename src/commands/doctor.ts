import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { ok, fail, type GlobalFlags } from '../output.js';
import { loadCloakBrowser } from '../browser.js';
import { paths } from '../utils/paths.js';
import { status as daemonStatus } from '../daemon/lifecycle.js';

type GF = () => GlobalFlags;

export function buildDoctorCmd(g: GF): Command {
  return new Command('doctor').description('Diagnose installation and runtime').action(async () => {
    const flags = g();
    const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

    // node
    checks.push({ name: 'node', ok: true, detail: process.version });

    // cloakbrowser
    let cbInfo: unknown = null;
    try {
      const cb = await loadCloakBrowser();
      checks.push({ name: 'cloakbrowser', ok: true });
      if (cb.binaryInfo) {
        try {
          cbInfo = cb.binaryInfo();
          checks.push({ name: 'cloakbrowser.binary', ok: true, detail: JSON.stringify(cbInfo) });
        } catch (err) {
          checks.push({ name: 'cloakbrowser.binary', ok: false, detail: (err as Error).message });
        }
      }
    } catch (err) {
      checks.push({ name: 'cloakbrowser', ok: false, detail: (err as Error).message });
    }

    // playwright-core
    try {
      await import('playwright-core');
      checks.push({ name: 'playwright-core', ok: true });
    } catch (err) {
      checks.push({ name: 'playwright-core', ok: false, detail: (err as Error).message });
    }

    // root paths
    checks.push({ name: 'cloak-root', ok: existsSync(paths.root), detail: paths.root });

    // daemon — informational, not required for one-shot mode
    const dst = daemonStatus();
    const daemonCheck = { name: 'daemon', ok: true, detail: dst.running ? `running (pid=${dst.pid})` : 'not running (start with `cloak daemon start` for long sessions)' };
    checks.push(daemonCheck);

    const required = checks.filter((c) => c.name !== 'daemon');
    const allOk = required.every((c) => c.ok);
    ok({ ok: allOk, checks, binary: cbInfo }, flags);
  });
}

export function buildTestCmd(g: GF): Command {
  return new Command('test').description('Quick fingerprint test (navigate to a detector and report)')
    .option('--detector <name>', 'fingerprintjs|browserscan|botd|sannysoft', 'fingerprintjs')
    .option('--humanize', 'Enable humanize for the test')
    .option('--proxy <url>')
    .option('--screenshot <path>', 'Save screenshot of the test page')
    .option('--wait-until <event>', 'Navigation wait strategy (load|domcontentloaded|networkidle|commit)', 'domcontentloaded')
    .option('--timeout <ms>', 'Navigation timeout in milliseconds', '60000')
    .action(async (opts: Record<string, unknown>) => {
      const flags = g();
      try {
        const { oneShotFetch } = await import('../one-shot.js');
        const url = detectorUrl(String(opts.detector ?? 'fingerprintjs'));
        const waitUntil = (opts.waitUntil as string) || 'domcontentloaded';
        const navTimeout = Number(opts.timeout) || 60000;
        const fetchOpts: Parameters<typeof oneShotFetch>[1] = {
          ...(opts.humanize ? { humanize: true } : {}),
          ...(opts.proxy ? { proxy: opts.proxy as string } : {}),
          waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle' | 'commit',
          navTimeout,
          wantText: true,
        };
        if (opts.screenshot) {
          fetchOpts.screenshotPath = opts.screenshot as string;
          fetchOpts.fullPage = true;
        }
        const res = await oneShotFetch(url, fetchOpts);
        ok({ detector: opts.detector, requested_url: url, ...res }, flags);
      } catch (err) { fail(err, flags); }
    });
}

function detectorUrl(name: string): string {
  switch (name) {
    case 'fingerprintjs': return 'https://demo.fingerprint.com/playground';
    case 'browserscan': return 'https://www.browserscan.net/';
    case 'botd': return 'https://fingerprint.com/products/bot-detection/';
    case 'sannysoft': return 'https://bot.sannysoft.com/';
    default: return name;
  }
}

export function buildVersionCmd(g: GF, cliVersion: string): Command {
  return new Command('version').description('Show versions for cli, cloakbrowser, and chromium').action(async () => {
    const flags = g();
    let cbInfo: unknown = null;
    let cbVersion: string | undefined;
    try {
      const cb = await loadCloakBrowser();
      if (cb.binaryInfo) cbInfo = cb.binaryInfo();
      cbVersion = await readPackageVersion('cloakbrowser');
    } catch {
      // ignore
    }
    ok({ cli: cliVersion, cloakbrowser: cbVersion ?? 'unknown', binary: cbInfo, node: process.version, platform: process.platform }, flags);
  });
}

/**
 * cloakbrowser's package.json restricts "exports" to ".", "./puppeteer",
 * "./human" — no "./package.json" — so `require.resolve('cloakbrowser/package.json')`
 * always throws ERR_PACKAGE_PATH_NOT_EXPORTED regardless of whether the
 * package is installed. Walk the same node_modules search paths Node
 * itself would use to find the package *directory*, then read its
 * package.json directly as a plain file (not as a resolved export).
 */
export async function readPackageVersion(pkg: string): Promise<string | undefined> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { createRequire } = await import('node:module');
    const { join } = await import('node:path');
    const req = createRequire(import.meta.url);
    const candidateDirs = req.resolve.paths(pkg) ?? [];
    for (const dir of candidateDirs) {
      try {
        const raw = await readFile(join(dir, pkg, 'package.json'), 'utf8');
        const json = JSON.parse(raw) as { version?: string };
        if (json.version) return json.version;
      } catch {
        continue;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}
