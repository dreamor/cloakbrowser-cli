import { describe, expect, it, vi } from 'vitest';

const { storageState } = vi.hoisted(() => ({ storageState: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../src/browser.js', () => ({
  getDefaultContext: vi.fn().mockResolvedValue({ storageState }),
}));

import { storageMethods } from '../../src/daemon/methods/storage.js';
import { sessionMethods } from '../../src/daemon/methods/session.js';

const fakeCtx = (handle: unknown) => ({
  registry: {
    requireSession: () => ({ handle }),
  },
  startedAt: 0,
}) as never;

describe('daemon methods reject writes to sensitive paths', () => {
  it('storage.save refuses to write to a blocked directory', async () => {
    storageState.mockClear();
    await expect(
      storageMethods['storage.save']({ session_id: 's-1', path: '/etc/pwned.json' }, fakeCtx({}))
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(storageState).not.toHaveBeenCalled();
  });

  it('session.save_state refuses to write to a blocked directory (context handle)', async () => {
    const context = { storageState };
    storageState.mockClear();
    await expect(
      sessionMethods['session.save_state'](
        { session_id: 's-1', path: '/etc/pwned.json' },
        fakeCtx({ kind: 'context', context })
      )
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(storageState).not.toHaveBeenCalled();
  });

  it('session.save_state refuses to write to a blocked directory (browser handle)', async () => {
    const first = { storageState };
    storageState.mockClear();
    await expect(
      sessionMethods['session.save_state'](
        { session_id: 's-1', path: '/etc/pwned.json' },
        fakeCtx({ kind: 'browser', browser: { contexts: () => [first] } })
      )
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
    expect(storageState).not.toHaveBeenCalled();
  });

  it('storage.save allows a normal path', async () => {
    storageState.mockClear();
    await storageMethods['storage.save']({ session_id: 's-1', path: '/tmp/state.json' }, fakeCtx({}));
    expect(storageState).toHaveBeenCalledWith({ path: '/tmp/state.json' });
  });
});
