import { describe, expect, it } from 'vitest';
import { readPackageVersion } from '../../src/commands/doctor.js';

describe('readPackageVersion', () => {
  it('reads a real installed package version despite a restrictive "exports" map', async () => {
    // cloakbrowser's package.json only exports ".", "./puppeteer", "./human" —
    // no "./package.json" — so a naive require.resolve(`${pkg}/package.json`)
    // always throws ERR_PACKAGE_PATH_NOT_EXPORTED regardless of whether the
    // package is installed. This is the exact case that produced
    // `cloakbrowser: "unknown"` in `cloak version`.
    const version = await readPackageVersion('cloakbrowser');
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns undefined for a package that is not installed', async () => {
    const version = await readPackageVersion('this-package-does-not-exist-cloak-test');
    expect(version).toBeUndefined();
  });

  it('reads a package with a normal (unrestricted) exports map', async () => {
    const version = await readPackageVersion('commander');
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
