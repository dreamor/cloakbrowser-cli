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

  it('maps missing mmdb-lib (geoip) to MISSING_DEPENDENCY', () => {
    const e = new Error('mmdb-lib is required for geoip: true. Install it with:\n  npm install mmdb-lib');
    expect(fromUnknown(e).code).toBe('MISSING_DEPENDENCY');
  });

  it('maps geoip resolution timeout to TIMEOUT', () => {
    const e = new Error('GeoIP resolution timed out after 20s');
    expect(fromUnknown(e).code).toBe('TIMEOUT');
  });

  it('maps geoip resolution/lookup failures to NETWORK_ERROR', () => {
    expect(fromUnknown(new Error('GeoIP resolution failed: could not discover the egress IP')).code).toBe('NETWORK_ERROR');
    expect(fromUnknown(new Error('GeoIP lookup failed for 1.2.3.4: database unavailable')).code).toBe('NETWORK_ERROR');
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

  it('maps browser launch failures to BROWSER_LAUNCH_FAILED', () => {
    expect(fromUnknown(new Error('Failed to launch the browser process! spawn ENOENT')).code).toBe('BROWSER_LAUNCH_FAILED');
    expect(fromUnknown(new Error('Failed to launch "chrome" channel.')).code).toBe('BROWSER_LAUNCH_FAILED');
  });

  it('maps an unrecognized keyboard key name to INVALID_ARG', () => {
    const e = new Error('keyboard.press: Unknown key: "NotARealKey"');
    expect(fromUnknown(e).code).toBe('INVALID_ARG');
  });

  it('maps a plain license error (no CloakBrowserLicenseError name) to LICENSE_ERROR', () => {
    const e = new Error('CloakBrowser Pro: license key is invalid or expired (plan=unknown)');
    const mapped = fromUnknown(e);
    expect(mapped.code).toBe('LICENSE_ERROR');
    expect(mapped.message).toContain('plan=unknown');
  });

  it('maps Download failed HTTP 404 (bad --browser-version) to INVALID_ARG', () => {
    const e = new Error('Download failed: HTTP 404');
    expect(fromUnknown(e).code).toBe('INVALID_ARG');
  });

  it('maps other Download failed errors to NETWORK_ERROR', () => {
    expect(fromUnknown(new Error('Download failed: HTTP 503')).code).toBe('NETWORK_ERROR');
    expect(fromUnknown(new Error('Download failed: connection reset')).code).toBe('NETWORK_ERROR');
  });
});
