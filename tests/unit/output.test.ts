import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { writeBinaryOut, maybeFileOrBase64 } from '../../src/output.js';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

const hash = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

describe('writeBinaryOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes buffer to path and returns metadata', () => {
    const buf = Buffer.from('hello');
    const result = writeBinaryOut(buf, '/tmp/test.bin');
    expect(writeFileSync).toHaveBeenCalledWith('/tmp/test.bin', buf);
    expect(result.path).toBe('/tmp/test.bin');
    expect(result.size).toBe(5);
    expect(result.sha256).toBe(hash(buf));
  });

  it('works with empty buffer', () => {
    const buf = Buffer.alloc(0);
    const result = writeBinaryOut(buf, '/tmp/empty.bin');
    expect(result.size).toBe(0);
    expect(result.sha256).toBe(hash(buf));
  });

  it('works with large data', () => {
    const buf = Buffer.alloc(1024 * 1024, 'A');
    const result = writeBinaryOut(buf, '/tmp/large.bin');
    expect(result.size).toBe(1024 * 1024);
    expect(result.sha256).toBe(hash(buf));
  });
});

describe('maybeFileOrBase64', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to file when path provided', () => {
    const buf = Buffer.from('hello');
    const result = maybeFileOrBase64(buf, '/tmp/out.png');
    expect(writeFileSync).toHaveBeenCalledWith('/tmp/out.png', buf);
    expect(result.path).toBe('/tmp/out.png');
    expect(result.base64).toBeUndefined();
  });

  it('returns base64 when no path provided', () => {
    const buf = Buffer.from('hello');
    const result = maybeFileOrBase64(buf, undefined);
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(result.base64).toBe(Buffer.from('hello').toString('base64'));
    expect(result.path).toBeUndefined();
  });

  it('returns sha256 in both modes', () => {
    const buf = Buffer.from('data');
    const fileResult = maybeFileOrBase64(buf, '/tmp/x.bin');
    expect(fileResult.sha256).toBe(hash(buf));

    const b64Result = maybeFileOrBase64(buf, undefined);
    expect(b64Result.sha256).toBe(hash(buf));
  });

  it('returns size in both modes', () => {
    const buf = Buffer.from('hello');
    const fileResult = maybeFileOrBase64(buf, '/tmp/x.bin');
    expect(fileResult.size).toBe(5);
    const b64Result = maybeFileOrBase64(buf, undefined);
    expect(b64Result.size).toBe(5);
  });

  it('returns path and size and sha256 when writing file', () => {
    const buf = Buffer.from('test-content');
    const result = maybeFileOrBase64(buf, '/tmp/screenshot.png');
    expect(result).toHaveProperty('path');
    expect(result).toHaveProperty('size');
    expect(result).toHaveProperty('sha256');
    expect(result).not.toHaveProperty('base64');
  });
});