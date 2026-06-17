import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resolveSid, saveAlias, removeAlias, loadAliases, saveLastSession, readLastSession } from '../../src/utils/session-resolver.js';
import { unlinkSync, mkdirSync } from 'node:fs';

const TEST_DIR = vi.hoisted(() => '/tmp/cloak-test-sr');

vi.mock('../../src/utils/paths.js', () => {
  const dir = '/tmp/cloak-test-sr';
  return {
    paths: {
      root: dir,
      sock: `${dir}/daemon.sock`,
      pid: `${dir}/daemon.pid`,
      log: `${dir}/daemon.log`,
      sessions: `${dir}/sessions`,
      tmp: `${dir}/tmp`,
    },
    ensureRoot: () => { /* already handled in beforeEach */ },
  };
});

describe('session-resolver', () => {
  beforeEach(() => {
    // Clean test state
    try { mkdirSync(TEST_DIR, { recursive: true }); } catch {}
    try { unlinkSync(`${TEST_DIR}/aliases.json`); } catch {}
    try { unlinkSync(`${TEST_DIR}/last-session.txt`); } catch {}
  });

  describe('loadAliases / saveAlias / removeAlias', () => {
    it('returns empty object when no alias file exists', () => {
      expect(loadAliases()).toEqual({});
    });

    it('saves and retrieves an alias', () => {
      saveAlias('login', 's-abc123');
      const aliases = loadAliases();
      expect(aliases.login).toBe('s-abc123');
    });

    it('overwrites existing alias with same name', () => {
      saveAlias('login', 's-first');
      saveAlias('login', 's-second');
      const aliases = loadAliases();
      expect(aliases.login).toBe('s-second');
    });

    it('saves multiple aliases', () => {
      saveAlias('login', 's-abc');
      saveAlias('scrape', 's-def');
      const aliases = loadAliases();
      expect(aliases.login).toBe('s-abc');
      expect(aliases.scrape).toBe('s-def');
    });

    it('removes an alias', () => {
      saveAlias('login', 's-abc');
      removeAlias('login');
      expect(loadAliases()).toEqual({});
    });

    it('removing non-existent alias does not throw', () => {
      expect(() => removeAlias('nonexistent')).not.toThrow();
    });

    it('handles special characters in alias names', () => {
      saveAlias('my-session_123', 's-xyz');
      expect(loadAliases()['my-session_123']).toBe('s-xyz');
    });
  });

  describe('resolveSid', () => {
    it('passes through normal session IDs unchanged', () => {
      expect(resolveSid('s-abc123')).toBe('s-abc123');
    });

    it('passes through empty string', () => {
      expect(resolveSid('')).toBe('');
    });

    it('resolves @name alias to session ID', () => {
      saveAlias('login', 's-abc123');
      expect(resolveSid('@login')).toBe('s-abc123');
    });

    it('throws CloakError for unknown @name', () => {
      expect(() => resolveSid('@unknown')).toThrow(/not found/);
    });

    it('throws CloakError with code SESSION_NOT_FOUND for unknown @name', () => {
      try {
        resolveSid('@unknown');
      } catch (e: unknown) {
        expect((e as Record<string, unknown>).code).toBe('SESSION_NOT_FOUND');
      }
    });

    it('resolves - to last session', () => {
      saveLastSession('s-latest');
      expect(resolveSid('-')).toBe('s-latest');
    });

    it('throws CloakError for - when no last session exists', () => {
      try { unlinkSync(`${TEST_DIR}/last-session.txt`); } catch {}
      expect(() => resolveSid('-')).toThrow(/No previous session/);
    });
  });

  describe('saveLastSession / readLastSession', () => {
    it('saves and reads last session', () => {
      saveLastSession('s-main');
      expect(readLastSession()).toBe('s-main');
    });

    it('overwrites last session on subsequent save', () => {
      saveLastSession('s-old');
      saveLastSession('s-new');
      expect(readLastSession()).toBe('s-new');
    });

    it('returns undefined when no last session exists', () => {
      try { unlinkSync(`${TEST_DIR}/last-session.txt`); } catch {}
      expect(readLastSession()).toBeUndefined();
    });
  });

  // Integration-style: end-to-end resolve flow
  describe('full resolution flow', () => {
    it('resolves @name → saveAlias → resolveSid', () => {
      saveAlias('checkout', 's-final');
      expect(resolveSid('@checkout')).toBe('s-final');
    });

    it('after saveLastSession, resolveSid("-") works', () => {
      saveLastSession('s-999');
      expect(resolveSid('-')).toBe('s-999');
    });
  });
});