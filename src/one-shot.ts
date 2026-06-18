import { launchFromResolved, getPageOrCreate } from './browser.js';
import { resolveLaunchOpts, type LaunchOpts } from './options.js';
import { htmlToMarkdown } from './utils/markdown.js';
import { maybeFileOrBase64 } from './output.js';

export type FetchOpts = LaunchOpts & {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  navTimeout?: number;
  referer?: string;

  // Outputs
  wantText?: boolean;
  wantHtml?: boolean;
  wantMarkdown?: boolean;
  screenshotPath?: string;
  fullPage?: boolean;
  pdfPath?: string;
  selector?: string; // restrict text/html extraction to a selector
};

export type FetchResult = {
  url: string;
  title: string;
  status: 'ok' | 'navigation-failed';
  text?: string;
  html?: string;
  markdown?: ReturnType<typeof htmlToMarkdown>;
  screenshot?: ReturnType<typeof maybeFileOrBase64>;
  pdf?: ReturnType<typeof maybeFileOrBase64>;
};

export async function oneShotFetch(url: string, opts: FetchOpts): Promise<FetchResult> {
  const resolved = resolveLaunchOpts(opts);
  const handle = await launchFromResolved(resolved);

  try {
    const page = await getPageOrCreate(handle);

    const gotoOpts: Record<string, unknown> = {};
    if (opts.waitUntil) gotoOpts.waitUntil = opts.waitUntil;
    if (opts.navTimeout !== undefined) gotoOpts.timeout = opts.navTimeout;
    if (opts.referer) gotoOpts.referer = opts.referer;

    let status: 'ok' | 'navigation-failed' = 'ok';
    try {
      await page.goto(url, gotoOpts);
    } catch (err) {
      status = 'navigation-failed';
      // Don't re-throw — return partial result so the agent can decide what to do
    }

    const result: FetchResult = {
      url: page.url(),
      title: await page.title(),
      status,
    };

    if (opts.wantText) {
      result.text = opts.selector
        ? await page.innerText(opts.selector)
        : await page.evaluate('document.body && document.body.innerText || ""');
    }

    if (opts.wantHtml || opts.wantMarkdown) {
      const html = opts.selector ? await page.innerHTML(opts.selector) : await page.content();
      if (opts.wantHtml) result.html = html;
      if (opts.wantMarkdown) result.markdown = htmlToMarkdown(html, page.url());
    }

    if (opts.screenshotPath !== undefined) {
      const buf = await page.screenshot({ fullPage: opts.fullPage ?? false });
      result.screenshot = maybeFileOrBase64(buf as Buffer, opts.screenshotPath || undefined);
    }

    if (opts.pdfPath !== undefined) {
      const buf = await page.pdf({});
      result.pdf = maybeFileOrBase64(buf as Buffer, opts.pdfPath || undefined);
    }

    return result;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export type ScrapeOpts = LaunchOpts & {
  selector: string;
  multi?: boolean;
  attr?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  navTimeout?: number;
};

export type ScrapeResult = {
  url: string;
  title: string;
  count: number;
  items: Array<{ text: string; html?: string; attr?: string | null }>;
};

export async function oneShotScrape(url: string, opts: ScrapeOpts): Promise<ScrapeResult> {
  const resolved = resolveLaunchOpts(opts);
  const handle = await launchFromResolved(resolved);

  try {
    const page = await getPageOrCreate(handle);
    const gotoOpts: Record<string, unknown> = {};
    if (opts.waitUntil) gotoOpts.waitUntil = opts.waitUntil;
    if (opts.navTimeout !== undefined) gotoOpts.timeout = opts.navTimeout;
    await page.goto(url, gotoOpts);

    const extracted = (await page.evaluate(
      `((args) => {
        const els = args.multi
          ? Array.from(document.querySelectorAll(args.sel))
          : [document.querySelector(args.sel)].filter(Boolean);
        return els.map((el) => ({
          text: (el.innerText || el.textContent || '').trim(),
          html: el.outerHTML,
          attr: args.attr ? el.getAttribute(args.attr) : null,
        }));
      })`,
      { sel: opts.selector, multi: Boolean(opts.multi), attr: opts.attr ?? null }
    )) as Array<{ text: string; html: string; attr: string | null }>;

    return {
      url: page.url(),
      title: await page.title(),
      count: extracted.length,
      items: extracted,
    };
  } finally {
    await handle.close().catch(() => undefined);
  }
}
