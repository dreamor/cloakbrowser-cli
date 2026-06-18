import { resolve, normalize } from 'node:path';
import { CloakError } from '../errors.js';

/**
 * Sensitive directories that should never be written to by the CLI.
 * Paths are normalized so trailing slashes are stripped.
 */
const BLOCKED_WRITE_PREFIXES: readonly string[] = [
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/sbin',
  '/usr/sbin',
];

/**
 * Check whether a given directory prefix (home-based) is blocked for writes.
 * E.g. ~/.ssh, ~/.gnupg, ~/.config/systemd
 */
function isBlockedHomeDir(absPath: string, home: string): boolean {
  if (!home) return false;
  const rel = absPath.startsWith(home + '/') ? absPath.slice(home.length) : '';
  if (!rel) return false;
  const blockedHomeDirs = ['/.ssh', '/.gnupg', '/.config/systemd'];
  return blockedHomeDirs.some((d) => rel === d || rel.startsWith(d + '/'));
}

/**
 * Validate a file path for write operations.
 *
 * - Resolves the path to an absolute, normalized form
 * - Blocks writes to sensitive system directories
 * - Blocks writes to sensitive home subdirectories (~/.ssh, ~/.gnupg)
 *
 * @returns The resolved absolute path
 * @throws CloakError with code IO_ERROR if the path is blocked
 */
export function validateWritePath(rawPath: string): string {
  const abs = resolve(normalize(rawPath));
  const home = process.env.HOME ?? '';

  for (const prefix of BLOCKED_WRITE_PREFIXES) {
    if (abs === prefix || abs.startsWith(prefix + '/')) {
      throw new CloakError(
        'IO_ERROR',
        `Refusing to write to sensitive directory: ${abs}`
      );
    }
  }

  if (isBlockedHomeDir(abs, home)) {
    throw new CloakError(
      'IO_ERROR',
      `Refusing to write to sensitive home directory: ${abs}`
    );
  }

  return abs;
}

/**
 * Validate a file path for read operations (used by eval_file).
 *
 * - Resolves the path to an absolute, normalized form
 * - Blocks reading from sensitive system directories to prevent data exfiltration
 *
 * @returns The resolved absolute path
 * @throws CloakError with code IO_ERROR if the path is blocked
 */
export function validateReadPath(rawPath: string): string {
  const abs = resolve(normalize(rawPath));
  const home = process.env.HOME ?? '';

  // Block reading from sensitive system dirs
  const blockedReadPrefixes = ['/proc', '/sys', '/dev'];
  for (const prefix of blockedReadPrefixes) {
    if (abs === prefix || abs.startsWith(prefix + '/')) {
      throw new CloakError(
        'IO_ERROR',
        `Refusing to read from system directory: ${abs}`
      );
    }
  }

  // Block reading from sensitive home dirs
  if (isBlockedHomeDir(abs, home)) {
    throw new CloakError(
      'IO_ERROR',
      `Refusing to read from sensitive home directory: ${abs}`
    );
  }

  return abs;
}
