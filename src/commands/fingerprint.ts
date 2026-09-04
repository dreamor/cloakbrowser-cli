import { Command } from 'commander';
import { ok, type GlobalFlags } from '../output.js';

type GF = () => GlobalFlags;

const FINGERPRINT_OPTIONS = [
  { flag: '--fingerprint <seed>', description: 'Deterministic fingerprint seed (enables fingerprint mode)' },
  { flag: '--platform <name>', description: 'Platform to spoof (windows|macos|linux)' },
  { flag: '--platform-version <v>', description: 'Platform version to spoof' },
  { flag: '--brand <name>', description: 'Browser brand to spoof' },
  { flag: '--brand-version <v>', description: 'Browser brand version to spoof' },
  { flag: '--gpu-vendor <v>', description: 'GPU vendor to spoof' },
  { flag: '--gpu-renderer <v>', description: 'GPU renderer to spoof' },
  { flag: '--hardware-concurrency <n>', description: 'navigator.hardwareConcurrency value' },
  { flag: '--device-memory <n>', description: 'navigator.deviceMemory value (GB)' },
  { flag: '--screen <WxH>', description: 'Spoofed screen size (e.g. 1920x1080)' },
  { flag: '--webrtc-ip <ip>', description: 'WebRTC ICE candidate IP (auto|<ip>)' },
];

export function buildFingerprintCmd(g: GF): Command {
  return new Command('fingerprint')
    .description('Show fingerprint configuration options and usage')
    .action(() => {
      const flags = g();
      const lines = [
        'Fingerprint options are passed at session creation to configure browser fingerprinting.',
        '',
        'Usage:',
        '  cloak session new --fingerprint <seed> [--platform <name>] ...',
        '  cloak fetch <url> --fingerprint <seed> ...',
        '  cloak scrape <url> --fingerprint <seed> ...',
        '',
        'Options:',
        ...FINGERPRINT_OPTIONS.map((o) => `  ${o.flag.padEnd(40)} ${o.description}`),
        '',
        'Example:',
        '  cloak session new --fingerprint abc123 --platform windows',
        '  cloak fetch https://example.com --fingerprint abc123',
      ];
      ok({ help: lines.join('\n') }, flags);
    });
}
