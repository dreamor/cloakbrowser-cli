import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, unlinkSync } from 'node:fs';

const TEST_DIR = '/tmp/cloak-test-shared-cmd';

vi.mock('../../src/utils/paths.js', () => {
  const dir = '/tmp/cloak-test-shared-cmd';
  return {
    paths: {
      root: dir,
      sock: `${dir}/daemon.sock`,
      pid: `${dir}/daemon.pid`,
      log: `${dir}/daemon.log`,
      sessions: `${dir}/sessions`,
      tmp: `${dir}/tmp`,
    },
    ensureRoot: () => { /* no-op */ },
  };
});

vi.mock('../../src/client.js', () => ({
  getClient: vi.fn(() => {
    throw new Error('getClient() must not be called when session resolution fails');
  }),
}));

import { callDaemon } from '../../src/commands/shared.js';

describe('callDaemon session resolution failure', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    try { mkdirSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
    try { unlinkSync(`${TEST_DIR}/aliases.json`); } catch { /* ignore */ }
    try { unlinkSync(`${TEST_DIR}/last-session.txt`); } catch { /* ignore */ }
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('reports SESSION_NOT_FOUND (not BOOT_ERROR) for an unknown alias', async () => {
    await callDaemon('session.info', {}, '@nope', { pretty: false, quiet: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const written = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(written.ok).toBe(false);
    expect(written.error.code).toBe('SESSION_NOT_FOUND');
    expect(written.error.stack).toBeUndefined();
  });

  it('reports SESSION_NOT_FOUND for "-" with no prior session', async () => {
    await callDaemon('session.info', {}, '-', { pretty: false, quiet: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const written = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(written.error.code).toBe('SESSION_NOT_FOUND');
  });
});
