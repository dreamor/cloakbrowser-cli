import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveSid, saveAlias, saveLastSession, readLastSession } from '../../src/utils/session-resolver.js';
import { unlinkSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const TEST_DIR = '/tmp/cloak-test-shared';

vi.mock('../../src/utils/paths.js', () => {
  const dir = '/tmp/cloak-test-shared';
  return {
    paths: {
      root: dir,
      sock: `${dir}/daemon.sock`,
      pid: `${dir}/daemon.pid`,
      log: `${dir}/daemon.log`,
      sessions: `${dir}/sessions`,
      tmp: `${dir}/tmp`,
    },
    ensureRoot: () => { /* handled in beforeEach */ },
  };
});

// We test the resolution + tracking integration, not the RPC call
describe('session resolution integration', () => {
  beforeEach(() => {
    try { mkdirSync(TEST_DIR, { recursive: true }); } catch {}
    try { unlinkSync(`${TEST_DIR}/aliases.json`); } catch {}
    try { unlinkSync(`${TEST_DIR}/last-session.txt`); } catch {}
  });

  it('resolves @alias and saves as last session', () => {
    saveAlias('login', 's-abc123');
    const resolved = resolveSid('@login');
    expect(resolved).toBe('s-abc123');
    saveLastSession(resolved);
    expect(readLastSession()).toBe('s-abc123');
  });

  it('resolves - to previously saved last session', () => {
    saveLastSession('s-prev');
    const resolved = resolveSid('-');
    expect(resolved).toBe('s-prev');
  });

  it('resolves plain s-id unchanged', () => {
    expect(resolveSid('s-test')).toBe('s-test');
  });

  it('after saveLastSession, the file contains the id', () => {
    saveLastSession('s-latest');
    const raw = readFileSync(`${TEST_DIR}/last-session.txt`, 'utf8');
    expect(raw.trim()).toBe('s-latest');
  });
});