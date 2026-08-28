import { describe, expect, it } from 'vitest';
import { CloakError, fromUnknown } from '../../src/errors.js';

describe('CloakError', () => {
  it('roundtrips via toJSON', () => {
    const err = new CloakError('TIMEOUT', 'too slow', { ms: 5000 });
    expect(err.toJSON()).toEqual({ code: 'TIMEOUT', message: 'too slow', details: { ms: 5000 } });
  });

  it('omits details when missing', () => {
    expect(new CloakError('INVALID_ARG', 'bad').toJSON()).toEqual({ code: 'INVALID_ARG', message: 'bad' });
  });
});

describe('fromUnknown', () => {
  it('passes through CloakError', () => {
    const err = new CloakError('IO_ERROR', 'x');
    expect(fromUnknown(err)).toBe(err);
  });

  it('maps Playwright timeout to TIMEOUT', () => {
    const e = new Error('Timeout 5000ms exceeded.');
    expect(fromUnknown(e).code).toBe('TIMEOUT');
  });

  it('maps missing cloakbrowser to MISSING_DEPENDENCY', () => {
    const e = new Error("Cannot find module 'cloakbrowser'");
    expect(fromUnknown(e).code).toBe('MISSING_DEPENDENCY');
  });

  it('maps navigation failures', () => {
    const e = new Error('net::ERR_NAME_NOT_RESOLVED at https://invalid');
    expect(fromUnknown(e).code).toBe('NAVIGATION_FAILED');
  });

  it('maps humanize actionability failures to TIMEOUT', () => {
    const e = new Error('Element "#submit" failed visible check: element is not visible');
    e.name = 'ElementNotVisibleError';
    expect(fromUnknown(e).code).toBe('TIMEOUT');
  });

  it('maps CloakBrowserLicenseError (by name) to LICENSE_ERROR', () => {
    const e = new Error('CloakBrowser Pro: license key is invalid.');
    e.name = 'CloakBrowserLicenseError';
    const mapped = fromUnknown(e);
    expect(mapped.code).toBe('LICENSE_ERROR');
    expect(mapped.message).toBe('CloakBrowser Pro: license key is invalid.');
  });

  it('handles non-Error values', () => {
    expect(fromUnknown('something').code).toBe('INTERNAL_ERROR');
  });
});
