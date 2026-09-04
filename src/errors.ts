export type ErrorCode =
  | 'BOOT_ERROR'
  | 'INVALID_ARG'
  | 'INVALID_JSON'
  | 'MISSING_DEPENDENCY'
  | 'DAEMON_NOT_RUNNING'
  | 'DAEMON_ALREADY_RUNNING'
  | 'DAEMON_TIMEOUT'
  | 'SESSION_NOT_FOUND'
  | 'PAGE_NOT_FOUND'
  | 'BROWSER_LAUNCH_FAILED'
  | 'LICENSE_ERROR'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'SELECTOR_NOT_FOUND'
  | 'EVAL_FAILED'
  | 'NETWORK_ERROR'
  | 'IO_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'UNSUPPORTED_OPERATION'
  | 'INTERNAL_ERROR';

export class CloakError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CloakError';
    this.code = code;
    this.details = details;
  }

  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function fromUnknown(err: unknown): CloakError {
  if (err instanceof CloakError) return err;
  if (err instanceof Error) {
    // cloakbrowser >= 0.4.11 throws a named `CloakBrowserLicenseError` when
    // the Pro binary refuses a launch for a license reason. Detect by name
    // so we don't need to import the class (peer dep may be absent at type
    // time). Check this before the generic BROWSER_LAUNCH_FAILED fallback.
    if (err.name === 'CloakBrowserLicenseError') {
      return new CloakError('LICENSE_ERROR', err.message);
    }
    // Map known Playwright/cloakbrowser errors
    const msg = err.message;
    if (/Timeout .* exceeded/i.test(msg)) {
      return new CloakError('TIMEOUT', msg);
    }
    // Playwright's own browser-launch failures ("Failed to launch the
    // browser process", "... because executable doesn't exist at ...",
    // `Failed to launch "chrome" channel.`) all consistently include this
    // substring. Previously fell through to INTERNAL_ERROR even though
    // BROWSER_LAUNCH_FAILED was already a defined code nothing ever mapped to.
    if (/Failed to launch/i.test(msg)) {
      return new CloakError('BROWSER_LAUNCH_FAILED', msg);
    }
    // `keyboard.press`/`locator.press` reject with this exact shape for an
    // unrecognized key name — that's a caller mistake (bad --key value),
    // not an internal fault.
    if (/Unknown key:/i.test(msg)) {
      return new CloakError('INVALID_ARG', msg);
    }
    // cloakbrowser's humanize layer (`human/actionability.ts`) throws
    // ElementNot{Attached,Visible,Stable,Enabled,Editable,ReceivingEvents}Error /
    // ElementTargetChangedError with the shape `Element "sel" failed <check> check: ...`.
    // These only reach the caller after the internal action-retry deadline expires, so
    // TIMEOUT mirrors what non-humanized Playwright reports for the same condition
    // (and avoids them silently falling through to INTERNAL_ERROR, since the message
    // doesn't contain "selector"/"locator").
    if (/^Element .* failed .* check:/.test(msg)) {
      return new CloakError('TIMEOUT', msg);
    }
    if (/Cannot find module ['"]cloakbrowser['"]|Cannot find module ['"]playwright-core['"]/i.test(msg)) {
      return new CloakError('MISSING_DEPENDENCY', msg);
    }
    // cloakbrowser >= 0.5.10's `geoip.ts` throws instead of silently
    // returning nulls when `--geoip` can't resolve a timezone/locale.
    // Check these before the generic NAVIGATION_FAILED/net::ERR_ heuristic
    // below, since a proxy-side geoip lookup failure often also matches it.
    if (/mmdb-lib is required/i.test(msg)) {
      return new CloakError('MISSING_DEPENDENCY', msg);
    }
    if (/GeoIP resolution timed out/i.test(msg)) {
      return new CloakError('TIMEOUT', msg);
    }
    if (/GeoIP (resolution|lookup) failed/i.test(msg)) {
      return new CloakError('NETWORK_ERROR', msg);
    }
    if (/net::ERR_|page\.goto/i.test(msg)) {
      return new CloakError('NAVIGATION_FAILED', msg);
    }
    if (/selector|locator/i.test(msg)) {
      return new CloakError('SELECTOR_NOT_FOUND', msg);
    }
    return new CloakError('INTERNAL_ERROR', msg, { stack: err.stack });
  }
  return new CloakError('INTERNAL_ERROR', String(err));
}
