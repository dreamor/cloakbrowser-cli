import { describe, expect, it, vi, afterEach } from 'vitest';
import { withCloakbrowserStdoutRerouted } from '../../src/browser.js';

describe('withCloakbrowserStdoutRerouted', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reroutes [cloakbrowser]-prefixed stdout writes to stderr', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await withCloakbrowserStdoutRerouted(async () => {
      process.stdout.write('[cloakbrowser] Stealth Chromium 1.2.3 not found. Downloading...\n');
      return 'ok';
    });

    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith('[cloakbrowser] Stealth Chromium 1.2.3 not found. Downloading...\n');
  });

  it('leaves unrelated stdout writes on stdout', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await withCloakbrowserStdoutRerouted(async () => {
      process.stdout.write('{"ok":true,"data":{}}\n');
    });

    expect(stdoutWrite).toHaveBeenCalledWith('{"ok":true,"data":{}}\n');
  });

  it('always restores the original stdout.write, even when the callback throws', async () => {
    const original = process.stdout.write;

    await expect(
      withCloakbrowserStdoutRerouted(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(process.stdout.write).toBe(original);
  });

  it('returns the callback result', async () => {
    const result = await withCloakbrowserStdoutRerouted(async () => 42);
    expect(result).toBe(42);
  });
});
