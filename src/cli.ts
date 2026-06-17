import { Command } from 'commander';
import type { GlobalFlags } from './output.js';
import { getClient } from './client.js';
import { ensureRoot } from './utils/paths.js';

import { buildSessionCmd } from './commands/session.js';
import { buildPageCmd } from './commands/page.js';
import {
  buildNavCmd,
  buildBackCmd,
  buildForwardCmd,
  buildReloadCmd,
  buildUrlCmd,
  buildTitleCmd,
} from './commands/navigation.js';
import {
  buildContentCmd,
  buildTextCmd,
  buildHtmlCmd,
  buildAttrCmd,
  buildMarkdownCmd,
  buildScreenshotCmd,
  buildPdfCmd,
} from './commands/content.js';
import {
  buildClickCmd,
  buildDblclickCmd,
  buildFillCmd,
  buildTypeCmd,
  buildPressCmd,
  buildHoverCmd,
  buildFocusCmd,
  buildBlurCmd,
  buildScrollCmd,
  buildSelectCmd,
  buildCheckCmd,
  buildUploadCmd,
  buildDragCmd,
  buildDispatchCmd,
} from './commands/interaction.js';
import { buildEvalCmd, buildEvalFileCmd } from './commands/eval.js';
import {
  buildCookiesCmd,
  buildStorageCmd,
  buildLocalStorageCmd,
  buildSessionStorageCmd,
} from './commands/cookies.js';
import {
  buildWaitCmd,
  buildSleepCmd,
  buildSnapshotCmd,
  buildFramesCmd,
  buildA11yCmd,
  buildRequestCmd,
  buildDialogCmd,
} from './commands/misc.js';
import { buildDaemonCmd } from './commands/daemon.js';
import { buildFetchCmd, buildScrapeCmd } from './commands/oneshot.js';
import { buildBinaryCmd, buildServeCmd, buildConnectCmd } from './commands/binary.js';
import { buildBatchCmd } from './commands/batch.js';
import { buildDoctorCmd, buildTestCmd, buildVersionCmd } from './commands/doctor.js';
import { buildFingerprintCmd } from './commands/fingerprint.js';

import { version as packageVersion } from '../package.json';
const CLI_VERSION = packageVersion;

export async function main(argv: string[]): Promise<void> {
  ensureRoot();

  const program = new Command();
  program
    .name('cloak')
    .description('Agent-friendly CLI for CloakBrowser — stealth Chromium that passes bot detection.')
    .version(CLI_VERSION, '-V, --version', 'Show CLI version')
    .option('--pretty', 'Human-readable JSON output (auto when TTY)')
    .option('--quiet', 'Only emit the data field of successful responses')
    .option('--out <path>', 'Write large binary outputs to this file path');

  const globalFlags = (): GlobalFlags => {
    const o = program.opts();
    return {
      pretty: Boolean(o.pretty),
      quiet: Boolean(o.quiet),
      ...(o.out ? { out: o.out as string } : {}),
    };
  };

  // Daemon / session / page
  program.addCommand(buildDaemonCmd(globalFlags));
  program.addCommand(buildSessionCmd(globalFlags));
  program.addCommand(buildPageCmd(globalFlags));

  // Batch
  program.addCommand(buildBatchCmd(globalFlags));

  // Navigation
  program.addCommand(buildNavCmd(globalFlags));
  program.addCommand(buildBackCmd(globalFlags));
  program.addCommand(buildForwardCmd(globalFlags));
  program.addCommand(buildReloadCmd(globalFlags));
  program.addCommand(buildUrlCmd(globalFlags));
  program.addCommand(buildTitleCmd(globalFlags));

  // Content
  program.addCommand(buildContentCmd(globalFlags));
  program.addCommand(buildTextCmd(globalFlags));
  program.addCommand(buildHtmlCmd(globalFlags));
  program.addCommand(buildAttrCmd(globalFlags));
  program.addCommand(buildMarkdownCmd(globalFlags));
  program.addCommand(buildScreenshotCmd(globalFlags));
  program.addCommand(buildPdfCmd(globalFlags));

  // Interaction
  program.addCommand(buildClickCmd(globalFlags));
  program.addCommand(buildDblclickCmd(globalFlags));
  program.addCommand(buildFillCmd(globalFlags));
  program.addCommand(buildTypeCmd(globalFlags));
  program.addCommand(buildPressCmd(globalFlags));
  program.addCommand(buildHoverCmd(globalFlags));
  program.addCommand(buildFocusCmd(globalFlags));
  program.addCommand(buildBlurCmd(globalFlags));
  program.addCommand(buildScrollCmd(globalFlags));
  program.addCommand(buildSelectCmd(globalFlags));
  program.addCommand(buildCheckCmd(globalFlags, 'check'));
  program.addCommand(buildCheckCmd(globalFlags, 'uncheck'));
  program.addCommand(buildUploadCmd(globalFlags));
  program.addCommand(buildDragCmd(globalFlags));
  program.addCommand(buildDispatchCmd(globalFlags));

  // Eval
  program.addCommand(buildEvalCmd(globalFlags));
  program.addCommand(buildEvalFileCmd(globalFlags));

  // Cookies / storage
  program.addCommand(buildCookiesCmd(globalFlags));
  program.addCommand(buildStorageCmd(globalFlags));
  program.addCommand(buildLocalStorageCmd(globalFlags));
  program.addCommand(buildSessionStorageCmd(globalFlags));

  // Wait / snapshot / frames / a11y / network / dialog
  program.addCommand(buildWaitCmd(globalFlags));
  program.addCommand(buildSleepCmd(globalFlags));
  program.addCommand(buildSnapshotCmd(globalFlags));
  program.addCommand(buildFramesCmd(globalFlags));
  program.addCommand(buildA11yCmd(globalFlags));
  program.addCommand(buildRequestCmd(globalFlags));
  program.addCommand(buildDialogCmd(globalFlags));

  // One-shot
  program.addCommand(buildFetchCmd(globalFlags));
  program.addCommand(buildScrapeCmd(globalFlags));

  // Binary / serve / connect / doctor / test
  program.addCommand(buildBinaryCmd(globalFlags));
  program.addCommand(buildServeCmd(globalFlags));
  program.addCommand(buildConnectCmd(globalFlags));
  program.addCommand(buildDoctorCmd(globalFlags));
  program.addCommand(buildTestCmd(globalFlags));
  program.addCommand(buildVersionCmd(globalFlags, CLI_VERSION));

  // Fingerprint help
  program.addCommand(buildFingerprintCmd(globalFlags));

  // After parse, close client if it was opened
  program.hook('postAction', () => {
    try { getClient().close(); } catch { /* ignore */ }
  });

  await program.parseAsync(argv);
}
