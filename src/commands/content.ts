import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

export function buildContentCmd(g: GF): Command {
  return new Command('content').description('Get full page HTML').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.content', params, sid, flags);
    });
}

export function buildTextCmd(g: GF): Command {
  return new Command('text').description('Get text content (full body or selector)').argument('<session_id>')
    .option('--selector <sel>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.selector) params.selector = opts.selector;
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.text', params, sid, flags);
    });
}

export function buildHtmlCmd(g: GF): Command {
  return new Command('html').description('Get innerHTML of a selector').argument('<session_id>')
    .requiredOption('--selector <sel>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      await callDaemon('page.html', { selector: opts.selector, ...(opts.page ? { page_id: opts.page } : {}) }, sid, flags);
    });
}

export function buildAttrCmd(g: GF): Command {
  return new Command('attr').description('Get attribute of an element').argument('<session_id>').argument('<selector>').argument('<name>')
    .option('--page <id>')
    .action(async (sid: string, selector: string, name: string, opts: Record<string, unknown>) => {
      const flags = g();
      await callDaemon('page.attr', { selector, name, ...(opts.page ? { page_id: opts.page } : {}) }, sid, flags);
    });
}

export function buildMarkdownCmd(g: GF): Command {
  return new Command('markdown').description('Extract main content as markdown (Readability + Turndown)').argument('<session_id>')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.markdown', params, sid, flags);
    });
}

export function buildScreenshotCmd(g: GF): Command {
  return new Command('screenshot').description('Take a screenshot').argument('<session_id>')
    .option('--path <file>', 'Save to file (otherwise returns base64)')
    .option('--full-page', 'Capture full scrollable page')
    .option('--selector <sel>', 'Capture only the given element')
    .option('--format <fmt>', 'png|jpeg')
    .option('--quality <n>', 'JPEG quality 0-100')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      // --path takes precedence; fall back to global --out
      const outPath = (opts.path as string) || flags.out;
      if (outPath) params.path = outPath;
      if (opts.fullPage) params.full_page = true;
      if (opts.selector) params.selector = opts.selector;
      if (opts.format) params.format = opts.format;
      if (opts.quality) params.quality = Number(opts.quality);
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.screenshot', params, sid, flags);
    });
}

export function buildPdfCmd(g: GF): Command {
  return new Command('pdf').description('Render page as PDF').argument('<session_id>')
    .option('--path <file>')
    .option('--format <fmt>', 'Page format (A4, Letter, ...)')
    .option('--landscape')
    .option('--page <id>')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      // --path takes precedence; fall back to global --out
      const outPath = (opts.path as string) || flags.out;
      if (outPath) params.path = outPath;
      if (opts.format) params.format = opts.format;
      if (opts.landscape) params.landscape = true;
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.pdf', params, sid, flags);
    });
}