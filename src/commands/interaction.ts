import { Command } from 'commander';
import { callDaemon } from './shared.js';
import { fail, type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

function addCommon(cmd: Command): Command {
  return cmd
    .option('--page <id>')
    .option('--timeout <ms>')
    .option('--force')
    .option('--delay <ms>')
    .option('--snapshot', 'Return a snapshot after the operation');
}

function commonParams(opts: Record<string, unknown>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (opts.page) p.page_id = opts.page;
  if (opts.timeout) p.timeout = Number(opts.timeout);
  if (opts.force) p.force = true;
  if (opts.delay) p.delay = Number(opts.delay);
  if (opts.snapshot) p.want_snapshot = true;
  return p;
}

export function buildClickCmd(g: GF): Command {
  const cmd = new Command('click').description('Click an element').argument('<session_id>').argument('<selector>')
    .option('--button <name>', 'left|right|middle')
    .option('--click-count <n>')
    .option('--modifiers <list>', 'Comma-separated (Shift,Control,Alt,Meta)');
  addCommon(cmd);
  cmd.action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
    const flags = g();
    const params = commonParams(opts);
    params.selector = sel;
    if (opts.button) params.button = opts.button;
    if (opts.clickCount) params.click_count = Number(opts.clickCount);
    if (typeof opts.modifiers === 'string') params.modifiers = opts.modifiers.split(',').map((s) => s.trim()).filter(Boolean);
    await callDaemon('page.click', params, sid, flags);
  });
  return cmd;
}

export function buildDblclickCmd(g: GF): Command {
  const cmd = new Command('dblclick').description('Double-click an element').argument('<session_id>').argument('<selector>');
  addCommon(cmd);
  cmd.action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
    const flags = g();
    const params = commonParams(opts);
    params.selector = sel;
    await callDaemon('page.dblclick', params, sid, flags);
  });
  return cmd;
}

export function buildFillCmd(g: GF): Command {
  const cmd = new Command('fill').description('Fill an input').argument('<session_id>').argument('<selector>').argument('<value>');
  addCommon(cmd);
  cmd.action(async (sid: string, sel: string, value: string, opts: Record<string, unknown>) => {
    const flags = g();
    const params = commonParams(opts);
    params.selector = sel;
    params.value = value;
    await callDaemon('page.fill', params, sid, flags);
  });
  return cmd;
}

export function buildTypeCmd(g: GF): Command {
  const cmd = new Command('type').description('Type text into an input').argument('<session_id>').argument('<selector>').argument('<text>');
  addCommon(cmd);
  cmd.action(async (sid: string, sel: string, text: string, opts: Record<string, unknown>) => {
    const flags = g();
    const params = commonParams(opts);
    params.selector = sel;
    params.text = text;
    await callDaemon('page.type', params, sid, flags);
  });
  return cmd;
}

export function buildPressCmd(g: GF): Command {
  return new Command('press').description('Press a keyboard key').argument('<session_id>').argument('<key>')
    .option('--selector <sel>', 'Focus this selector before press')
    .option('--page <id>')
    .option('--delay <ms>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, key: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { key };
      if (opts.selector) params.selector = opts.selector;
      if (opts.page) params.page_id = opts.page;
      if (opts.delay) params.delay = Number(opts.delay);
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.press', params, sid, flags);
    });
}

export function buildHoverCmd(g: GF): Command {
  return new Command('hover').description('Hover over an element').argument('<session_id>').argument('<selector>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel };
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.hover', params, sid, flags);
    });
}

export function buildFocusCmd(g: GF): Command {
  return new Command('focus').description('Focus an element').argument('<session_id>').argument('<selector>')
    .option('--page <id>')
    .action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel };
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.focus', params, sid, flags);
    });
}

export function buildBlurCmd(g: GF): Command {
  return new Command('blur').description('Blur an element').argument('<session_id>').argument('<selector>')
    .option('--page <id>')
    .action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel };
      if (opts.page) params.page_id = opts.page;
      await callDaemon('page.blur', params, sid, flags);
    });
}

export function buildScrollCmd(g: GF): Command {
  return new Command('scroll').description('Scroll the page').argument('<session_id>')
    .option('--to <target>', 'top|bottom|<selector>')
    .option('-x, --x <px>')
    .option('-y, --y <px>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = {};
      if (opts.to) params.to = opts.to;
      if (opts.x !== undefined) params.x = Number(opts.x);
      if (opts.y !== undefined) params.y = Number(opts.y);
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.scroll', params, sid, flags);
    });
}

export function buildSelectCmd(g: GF): Command {
  return new Command('select').description('Select option(s) in a <select>').argument('<session_id>').argument('<selector>').argument('<value...>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, sel: string, values: string[], opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel, values };
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.select', params, sid, flags);
    });
}

export function buildCheckCmd(g: GF, name: 'check' | 'uncheck'): Command {
  return new Command(name).description(`${name} a checkbox`).argument('<session_id>').argument('<selector>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, sel: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel };
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon(`page.${name}`, params, sid, flags);
    });
}

export function buildUploadCmd(g: GF): Command {
  return new Command('upload').description('Upload files to a file input').argument('<session_id>').argument('<selector>').argument('<files...>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, sel: string, files: string[], opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel, files };
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.upload', params, sid, flags);
    });
}

export function buildDragCmd(g: GF): Command {
  return new Command('drag').description('Drag from one element to another').argument('<session_id>').argument('<from>').argument('<to>')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, from: string, to: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { from, to };
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.drag', params, sid, flags);
    });
}

export function buildDispatchCmd(g: GF): Command {
  return new Command('dispatch').description('Dispatch a DOM event').argument('<session_id>').argument('<selector>').argument('<event_type>')
    .option('--init <json>', 'Event init as JSON')
    .option('--page <id>')
    .option('--snapshot', 'Return a snapshot after the operation')
    .action(async (sid: string, sel: string, type: string, opts: Record<string, unknown>) => {
      const flags = g();
      const params: Record<string, unknown> = { selector: sel, event_type: type };
      if (opts.init) {
        try { params.event_init = JSON.parse(opts.init as string); }
        catch (err) { return fail(err, flags); }
      }
      if (opts.page) params.page_id = opts.page;
      if (opts.snapshot) params.want_snapshot = true;
      await callDaemon('page.dispatch_event', params, sid, flags);
    });
}