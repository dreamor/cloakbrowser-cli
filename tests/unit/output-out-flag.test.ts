import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdirSync, unlinkSync } from 'node:fs';

vi.mock('../../src/utils/paths.js', () => {
  const dir = '/tmp/cloak-test-repro-out';
  return {
    paths: {
      root: dir, sock: `${dir}/daemon.sock`, pid: `${dir}/daemon.pid`,
      log: `${dir}/daemon.log`, sessions: `${dir}/sessions`, tmp: `${dir}/tmp`,
    },
    ensureRoot: () => { /* no-op */ },
  };
});

vi.mock('../../src/client.js', () => ({
  getClient: vi.fn(() => ({
    call: vi.fn().mockResolvedValue({ title: 'ok' }),
  })),
}));

import { callDaemon } from '../../src/commands/shared.js';

describe('callDaemon + --out pointing at a blocked path', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    try { mkdirSync('/tmp/cloak-test-repro-out', { recursive: true }); } catch { /* ignore */ }
    try { unlinkSync('/tmp/cloak-test-repro-out/last-session.txt'); } catch { /* ignore */ }
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('reports IO_ERROR instead of rejecting unhandled when ok() cannot write --out', async () => {
    // Must resolve (not throw). If it rejected, the rejection would be
    // unhandled at every real CLI call site (`await callDaemon(...)` with
    // no surrounding try/catch), which is exactly the BOOT_ERROR pattern.
    await expect(
      callDaemon('page.title', {}, 's-real', { pretty: false, quiet: false, out: '/etc/pwned.json' })
    ).resolves.toBeUndefined();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const written = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(written.ok).toBe(false);
    expect(written.error.code).toBe('IO_ERROR');
  });
});
