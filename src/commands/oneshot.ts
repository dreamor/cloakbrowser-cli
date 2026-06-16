import { Command } from 'commander';
import { ok, fail, type GlobalFlags } from '../output.js';
import { attachLaunchOptions, pickLaunchOpts } from '../options.js';
import { oneShotFetch, oneShotScrape } from '../one-shot.js';

type GF = () => GlobalFlags;

export function buildFetchCmd(g: GF): Command {
  const cmd = new Command('fetch').description('One-shot: launch, navigate, extract, close').argument('<url>');
  attachLaunchOptions(cmd);
  cmd
    .option('--wait-until <state>', 'load|domcontentloaded|networkidle|commit')
    .option('--nav-timeout <ms>')
    .option('--referer <url>')
    .option('--text', 'Include page text in result')
    .option('--html', 'Include full HTML in result')
    .option('--markdown', 'Include Readability+Turndown markdown in result')
    .option('--selector <sel>', 'Restrict --text/--html extraction to selector')
    .option('--screenshot [path]', 'Take a screenshot; optional path to save (else base64)')
    .option('--full-page', 'Combine with --screenshot for full-page capture')
    .option('--pdf [path]', 'Render PDF; optional path to save')
    .action(async (url: string, opts: Record<string, unknown>) => {
      const flags = g();
      try {
        const launch = pickLaunchOpts(opts);
        // screenshotPath: local --screenshot <path> takes precedence, fall back to global --out
        const localScreenshot = typeof opts.screenshot === 'string' ? opts.screenshot : '';
        const data = await oneShotFetch(url, {
          ...launch,
          ...(opts.waitUntil ? { waitUntil: opts.waitUntil as 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } : {}),
          ...(opts.navTimeout ? { navTimeout: Number(opts.navTimeout) } : {}),
          ...(opts.referer ? { referer: opts.referer as string } : {}),
          wantText: Boolean(opts.text),
          wantHtml: Boolean(opts.html),
          wantMarkdown: Boolean(opts.markdown),
          ...(opts.selector ? { selector: opts.selector as string } : {}),
          ...(opts.screenshot !== undefined ? {
            screenshotPath: localScreenshot || flags.out || '',
          } : {}),
          fullPage: Boolean(opts.fullPage),
          ...(opts.pdf !== undefined ? {
            pdfPath: typeof opts.pdf === 'string' ? opts.pdf : flags.out || '',
          } : {}),
        });
        ok(data, flags);
      } catch (err) { fail(err, flags); }
    });
  return cmd;
}

export function buildScrapeCmd(g: GF): Command {
  const cmd = new Command('scrape').description('One-shot: extract a selector from a URL').argument('<url>');
  attachLaunchOptions(cmd);
  cmd
    .requiredOption('--selector <sel>')
    .option('--multi', 'Return all matches instead of the first')
    .option('--attr <name>', 'Extract this attribute instead of text')
    .option('--wait-until <state>')
    .option('--nav-timeout <ms>')
    .action(async (url: string, opts: Record<string, unknown>) => {
      const flags = g();
      try {
        const launch = pickLaunchOpts(opts);
        const data = await oneShotScrape(url, {
          ...launch,
          selector: opts.selector as string,
          multi: Boolean(opts.multi),
          ...(opts.attr ? { attr: opts.attr as string } : {}),
          ...(opts.waitUntil ? { waitUntil: opts.waitUntil as 'load' | 'domcontentloaded' | 'networkidle' | 'commit' } : {}),
          ...(opts.navTimeout ? { navTimeout: Number(opts.navTimeout) } : {}),
        });
        ok(data, flags);
      } catch (err) { fail(err, flags); }
    });
  return cmd;
}
